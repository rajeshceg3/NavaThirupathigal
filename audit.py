import asyncio
from playwright.async_api import async_playwright

async def run_audit(playwright):
    browser = await playwright.chromium.launch()

    # Scenarios
    viewports = [
        {"name": "Desktop", "width": 1920, "height": 1080},
        {"name": "Mobile", "width": 375, "height": 812}
    ]

    for vp in viewports:
        print(f"\n--- Auditing {vp['name']} Viewport ---")
        context = await browser.new_context(viewport={"width": vp['width'], "height": vp['height']})
        page = await context.new_page()

        # error collection
        console_errors = []
        failed_requests = []

        page.on("console", lambda msg: console_errors.append(f"{msg.type}: {msg.text} {msg.location}") if msg.type == "error" else None)
        page.on("requestfailed", lambda request: failed_requests.append(f"{request.url} - {request.failure}"))

        try:
            await page.goto("http://localhost:8000")
            print("Page loaded.")

            # 1. Intro Screen Check
            if await page.is_visible("#intro-screen"):
                print("Intro screen visible.")
            else:
                print("ERROR: Intro screen not visible on load.")

            # 2. Start Journey
            await page.click("#intro-button")
            await page.wait_for_timeout(2000) # Wait for animation
            print("Clicked 'Begin Journey'.")

            # 3. Check App Container
            if await page.is_visible("#app-container"):
                print("App container visible.")
            else:
                print("ERROR: App container not visible after click.")

            # 4. Check Map
            # Leaflet map usually puts tiles in .leaflet-tile-pane
            tile_count = await page.locator(".leaflet-tile-pane img").count()
            if tile_count > 0:
                print(f"Map tiles loaded ({tile_count} tiles).")
            else:
                print("WARNING: No map tiles detected (could be canvas or slow load).")

            # 5. Check Navigation Items
            items_locator = page.locator(".temple-item")
            count = await items_locator.count()
            print(f"Found {count} temple items.")

            if count > 0:
                # Click the second item (index 1) to test interaction
                await items_locator.nth(1).click()
                print("Clicked second temple item.")
                await page.wait_for_timeout(2000) # Wait for flyTo and info card

                # 6. Check Info Card
                if await page.is_visible("#info-card") and "visible" in await page.get_attribute("#info-card", "class"):
                    print("Info card visible.")

                    # Verify content in info card
                    title = await page.text_content("#info-card-title")
                    print(f"Info Card Title: {title}")

                    img_src = await page.get_attribute("#info-card-image", "src")
                    if not img_src:
                         print("ERROR: Info card image source missing.")
                    else:
                         print(f"Info card image: {img_src}")

                else:
                    print("ERROR: Info card did not become visible.")

            # 7. Take Screenshot
            await page.screenshot(path=f"audit_screenshot_{vp['name']}.png")
            print(f"Screenshot saved for {vp['name']}.")

        except Exception as e:
            print(f"EXCEPTION during audit: {e}")
            import traceback
            traceback.print_exc()

        # Report Errors
        if console_errors:
            print("CONSOLE ERRORS FOUND:")
            for err in console_errors:
                print(f"  - {err}")
        else:
            print("No console errors.")

        if failed_requests:
            print("FAILED NETWORK REQUESTS:")
            for req in failed_requests:
                print(f"  - {req}")
        else:
            print("No failed network requests.")

        await context.close()

    await browser.close()

async def main():
    async with async_playwright() as p:
        await run_audit(p)

if __name__ == "__main__":
    asyncio.run(main())
