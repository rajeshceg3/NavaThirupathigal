import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()

        # Desktop
        print(" capturing Desktop...")
        page = await browser.new_page(viewport={'width': 1920, 'height': 1080})
        await page.goto("http://localhost:8000")
        await page.wait_for_timeout(3000) # Wait for animations
        await page.screenshot(path="screenshot_desktop.png")

        # Mobile
        print(" capturing Mobile...")
        page_mobile = await browser.new_page(viewport={'width': 375, 'height': 812}, user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1')
        await page_mobile.goto("http://localhost:8000")
        await page_mobile.wait_for_timeout(3000)
        await page_mobile.screenshot(path="screenshot_mobile.png")

        await browser.close()

asyncio.run(main())
