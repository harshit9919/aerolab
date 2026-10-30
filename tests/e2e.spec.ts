import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make the invisible visible." }),
  ).toBeVisible();
  await expect(
    page.getByText("Local workspace", { exact: true }),
  ).toBeVisible();
}
async function slider(page: Page, label: string, value: number) {
  await page
    .getByRole("slider", { name: label, exact: true })
    .fill(String(value));
}
async function saveShortRun(page: Page) {
  await slider(page, "Wind speed", 40);
  await page.getByRole("button", { name: "10s", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Playback speed" })
    .selectOption("4");
  await page.getByRole("button", { name: "Record run", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop & save", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("saved", {
    timeout: 25000,
  });
  await page.getByRole("button", { name: "Experiments", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your experiments" }),
  ).toBeVisible();
  await expect(page.locator(".run-table tbody tr")).toHaveCount(1);
}

test("studio starts with a live viewport, pause freezes time, and speed changes forces", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator("canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  const timeline = page.getByRole("slider", { name: "Simulation timeline" });
  const stopped = await timeline.inputValue();
  await page.waitForTimeout(350);
  await expect(timeline).toHaveValue(stopped);
  const drag = page
    .locator(".metric-card")
    .filter({ hasText: "DRAG FORCE" })
    .locator(".metric-value");
  const before = await drag.textContent();
  await slider(page, "Wind speed", 60);
  await expect(
    page.getByRole("slider", { name: "Wind speed", exact: true }),
  ).toHaveValue("60");
  await expect(drag).not.toHaveText(before!);
  await expect(page.locator(".flow-indicator")).toContainText("60.0");
});

test("record, compare, export, and replay preserve recorded conditions across reload", async ({
  page,
}) => {
  await ready(page);
  await saveShortRun(page);
  await expect(
    page.getByRole("cell", { name: "10 s", exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /Compare Sportscar/ }).check();
  await expect(
    page.getByRole("heading", { name: "Test conditions & geometry" }),
  ).toBeVisible();
  await expect(page.getByText("Baseline", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export workspace", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("aerolab-workspace.json");
  await page.getByRole("button", { name: /Replay Sportscar/ }).click();
  await expect(
    page.getByRole("slider", { name: "Wind speed", exact: true }),
  ).toHaveValue("40");
  await expect(
    page.getByRole("slider", { name: "Simulation timeline" }),
  ).toHaveValue("0");
  await expect(
    page.getByRole("button", { name: "Play simulation", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          new Promise<number>((resolve, reject) => {
            const request = indexedDB.open("aerolab", 1);
            request.onsuccess = () => {
              const db = request.result;
              const r = db
                .transaction("session")
                .objectStore("session")
                .get("current");
              r.onsuccess = () => {
                db.close();
                resolve(r.result?.settings.speed ?? -1);
              };
              r.onerror = () => reject(r.error);
            };
          }),
      ),
    )
    .toBe(40);
  await page.reload();
  await expect(
    page.getByRole("slider", { name: "Wind speed", exact: true }),
  ).toHaveValue("40");
  await page.getByRole("button", { name: "Experiments", exact: true }).click();
  await expect(page.locator(".run-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: /Replay Sportscar/ }).click();
  await expect(
    page.getByRole("slider", { name: "Wind speed", exact: true }),
  ).toHaveValue("40");
});

test("custom assembly part edits persist in the model library", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Create custom object", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Assembly name" })
    .fill("Browser wing assembly");
  await page.getByRole("button", { name: "wing", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "position X", exact: true })
    .fill("1.5");
  await page
    .getByRole("spinbutton", { name: "scale Z", exact: true })
    .fill("4");
  await page
    .getByRole("button", { name: "Save to My models", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("saved to My models");
  await page.reload();
  await page
    .getByRole("button", { name: "Model library", exact: true })
    .click();
  const card = page
    .locator(".library-model-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Browser wing assembly",
        exact: true,
      }),
    });
  await expect(card).toBeVisible();
  await card
    .getByRole("button", { name: "Edit geometry", exact: true })
    .click();
  await page
    .locator(".parts-list")
    .getByRole("button", { name: "Wing", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "position X", exact: true }),
  ).toHaveValue("1.5");
  await expect(
    page.getByRole("spinbutton", { name: "scale Z", exact: true }),
  ).toHaveValue("4");
});

const tetra = `solid tetra
facet normal 0 0 -1
 outer loop
 vertex 0 0 0
 vertex 0 1 0
 vertex 1 0 0
 endloop
endfacet
facet normal 0 -1 0
 outer loop
 vertex 0 0 0
 vertex 1 0 0
 vertex 0 0 1
 endloop
endfacet
facet normal -1 0 0
 outer loop
 vertex 0 0 0
 vertex 0 0 1
 vertex 0 1 0
 endloop
endfacet
facet normal 1 1 1
 outer loop
 vertex 1 0 0
 vertex 0 1 0
 vertex 0 0 1
 endloop
endfacet
endsolid tetra`;
test("ASCII STL import is retained after reload and rejected files report errors", async ({
  page,
}) => {
  await ready(page);
  const modelInput = page.locator(
    'input[type=file][accept=".glb,.gltf,.stl,.obj"]',
  );
  await modelInput.setInputFiles({
    name: "Browser tetrahedron.stl",
    mimeType: "model/stl",
    buffer: Buffer.from(tetra),
  });
  await expect(page.getByRole("status")).toContainText(
    "Imported Browser tetrahedron.stl",
  );
  await expect(page.locator(".scene-label strong")).toHaveText(
    "Browser tetrahedron",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Model library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Browser tetrahedron", exact: true }),
  ).toBeVisible();
  await modelInput.setInputFiles({
    name: "invalid.obj",
    mimeType: "text/plain",
    buffer: Buffer.from("not valid geometry"),
  });
  await expect(page.getByRole("status")).toContainText("Import failed:");
  await page
    .locator('input[type=file][accept=".json"]')
    .setInputFiles({
      name: "broken-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        '{"version":1,"models":[],"runs":[],"settings":{"speed":null}}',
      ),
    });
  await expect(page.getByRole("status")).toContainText("Restore failed:");
  await expect(
    page.getByRole("heading", { name: "Browser tetrahedron", exact: true }),
  ).toBeVisible();
});

test("parameter sweep generates three persisted runs with baseline comparison values", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Parameter sweep", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Parameter sweep",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("spinbutton", { name: "Sweep start", exact: true })
    .fill("0");
  await dialog
    .getByRole("spinbutton", { name: "Sweep end", exact: true })
    .fill("50");
  await dialog
    .getByRole("spinbutton", { name: "Sweep run count", exact: true })
    .fill("3");
  await dialog
    .getByRole("button", { name: "Generate estimated runs", exact: true })
    .click();
  const rows = page.locator(".experiment-list .run-table tbody tr");
  await expect(rows).toHaveCount(3);
  const zero = rows.filter({
    has: page.getByRole("button", {
      name: "Sportscar · Wind speed 0 m/s",
      exact: true,
    }),
  });
  await expect(
    zero.getByRole("cell", { name: "0 N", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "Compare Sportscar · Wind speed 25 m/s",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Compare Sportscar · Wind speed 50 m/s",
      exact: true,
    })
    .check();
  const cards = page.locator(".compare-card");
  await expect(cards).toHaveCount(2);
  await expect(
    cards.first().getByText("Baseline", { exact: true }),
  ).toBeVisible();
  await expect(
    cards
      .first()
      .getByRole("heading", {
        name: "Sportscar · Wind speed 25 m/s",
        exact: true,
      }),
  ).toBeVisible();
  await expect(cards.nth(1)).toContainText("+300.0% vs baseline");
  for (const card of await cards.all())
    await expect(
      card
        .locator(".comparison-stats > div")
        .filter({ hasText: "Mean Cd" })
        .locator("dd"),
    ).toHaveText("0.292");
  const dragValues = await cards.locator(".comparison-value").allTextContents();
  const values = dragValues.map((text) =>
    Number(text.replace(/,/g, "").match(/[\d.]+/)?.[0]),
  );
  expect(values[0]).toBeGreaterThan(0);
  expect(values[1] / values[0]).toBeCloseTo(4, 2);
  await page.reload();
  await page.getByRole("button", { name: "Experiments", exact: true }).click();
  await expect(rows).toHaveCount(3);
  for (const speed of [0, 25, 50])
    await expect(
      page.getByRole("button", {
        name: `Sportscar · Wind speed ${speed} m/s`,
        exact: true,
      }),
    ).toBeVisible();
});

test("mobile studio has no horizontal overflow and exposes settings and editor primitives", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make the invisible visible." }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
          ) - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
  await page
    .getByRole("button", { name: "Toggle settings", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "Wind speed", exact: true }),
  ).toBeVisible();
  await slider(page, "Wind speed", 55);
  await expect(
    page.getByRole("slider", { name: "Wind speed", exact: true }),
  ).toHaveValue("55");
  await expect(page.locator(".flow-indicator")).toContainText("55.0");
  await page
    .getByRole("button", { name: "Toggle settings", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Geometry editor", exact: true })
    .click();
  const primitives = page.locator(".primitive-grid");
  await expect(primitives).toBeVisible();
  await expect(
    primitives.getByRole("button", { name: "wing", exact: true }),
  ).toBeVisible();
  const viewportBounds = await page.locator(".viewport-shell").boundingBox();
  const editorBounds = await page.locator(".objects-panel").boundingBox();
  expect(editorBounds!.y).toBeGreaterThanOrEqual(
    viewportBounds!.y + viewportBounds!.height,
  );
  await primitives.getByRole("button", { name: "wing", exact: true }).click();
  await expect(
    page
      .locator(".parts-list")
      .getByRole("button", { name: "Wing", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Math.max(
            document.documentElement.scrollWidth,
            document.body.scrollWidth,
          ) - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
});
