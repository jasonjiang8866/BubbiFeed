"""Exercise BubbiFeed through its iPhone UI on a fresh Expo Appium device."""
import base64
import json
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

from appium import webdriver
from appium.options.ios import XCUITestOptions
from appium.webdriver.common.appiumby import AppiumBy
from selenium.common.exceptions import WebDriverException

BUNDLE = "com.nfusia.feedmybaby"
OUT = Path(os.environ["EVIDENCE_DIR"])
OUT.mkdir(parents=True, exist_ok=True)


class FeedingDevice:
    def __init__(self, driver):
        self.driver = driver
        self.step = "open"
        self.results = []

    def checkpoint(self, name):
        self.step = name
        print(name, flush=True)

    def screen(self, name):
        self.driver.save_screenshot(str(OUT / f"{name}.png"))
        (OUT / f"{name}.xml").write_text(self.driver.page_source)

    def match(self, label, prefix=False):
        value = json.dumps(label)
        op = "BEGINSWITH" if prefix else "=="
        query = f"visible == 1 AND (label {op} {value} OR name {op} {value} OR value == {value})"
        return self.driver.find_elements(AppiumBy.IOS_PREDICATE, query)

    def find(self, label, *, prefix=False, scroll=False, direction="up"):
        for attempt in range(7):
            elements = self.match(label, prefix)
            if elements:
                return elements[0]
            if scroll and attempt in (1, 3, 5):
                self.driver.execute_script("mobile: swipe", {"direction": direction})
            time.sleep(0.4)
        raise AssertionError(f"Missing visible control: {label}")

    def press(self, label, **kwargs):
        self.checkpoint(f"press {label}")
        self.find(label, **kwargs).click()

    def tab(self, label):
        # React Navigation may append the tab's ordinal to its accessibility label.
        self.press(label, prefix=True)

    def labels(self):
        tree = ET.fromstring(self.driver.page_source)
        return [e.get("label", "") for e in tree.iter("XCUIElementTypeStaticText")]

    def stats(self, *, bottles, solids, nursing=0):
        self.tab("Insights")
        self.find("210 ml", scroll=True, direction="down")
        self.find("Weekly Activity Breakdown", scroll=True)
        labels = " | ".join(self.labels())
        for label, count in [("Nursing Sessions", nursing), ("Bottle Feedings", bottles),
                             ("Solid Feedings", solids)]:
            if not re.search(re.escape(label) + r"\s*\|\s*" + str(count) + r"(?:\s*\||$)", labels):
                raise AssertionError(f"Expected {label} = {count}")

    def bottle_and_solid(self):
        self.tab("Home")
        self.find("Little Sweetheart", prefix=True)
        self.screen("home")
        self.press("120 ml", scroll=True)
        self.press("90 ml", scroll=True)
        self.stats(bottles=2, solids=0)
        self.screen("bottles-before-solid")
        self.tab("Log Feed")
        self.press("SOLID")
        self.press("Oatmeal", scroll=True)
        self.press("SAVE FEEDING SESSION", scroll=True)
        self.stats(bottles=2, solids=1)
        self.screen("bottles-after-solid")

    def nursing(self):
        self.tab("Log Feed")
        self.press("BREAST", scroll=True, direction="down")
        self.press("Start left timer", scroll=True)
        left_start = time.monotonic()
        self.find("Pause left timer")
        self.driver.background_app(4)
        self.find("Pause left timer")
        assert self.driver.terminate_app(BUNDLE), "App did not terminate"
        time.sleep(3)
        self.driver.activate_app(BUNDLE)
        self.tab("Home")
        self.find("Continue nursing for Little Sweetheart")
        self.screen("timer-after-relaunch")

        self.tab("Settings")
        self.press("Add Baby", scroll=True)
        field = self.find("e.g. Liam, Emma", scroll=True)
        field.send_keys("Basil")
        try:
            self.driver.hide_keyboard()
        except WebDriverException:
            pass
        self.press("Save Baby", scroll=True)
        self.find("Baby Profiles")
        self.tab("Home")
        self.find("Switch to Little", prefix=True)
        assert not self.match("Continue nursing for Little Sweetheart")
        self.tab("Log Feed")
        self.find("Start left timer", scroll=True)
        assert self.labels().count("00:00") >= 2, "Second profile inherited elapsed time"
        self.screen("second-profile")
        self.tab("Home")
        self.press("Switch to Little", prefix=True)
        self.press("Continue nursing for Little Sweetheart")
        self.press("Pause left timer", scroll=True)
        left_elapsed = time.monotonic() - left_start
        self.press("Start right timer", scroll=True)
        right_start = time.monotonic()
        self.find("Pause right timer")
        time.sleep(2)
        self.press("SAVE FEEDING SESSION", scroll=True)
        right_elapsed = time.monotonic() - right_start
        self.tab("Home")
        self.find("Switch to Basil", prefix=True, scroll=True, direction="down")
        assert not self.match("Continue nursing for Little Sweetheart")
        self.tab("History")
        self.press("BREAST")
        self.find("L:", prefix=True, scroll=True)
        labels = self.labels()
        for side, measured in [("L", left_elapsed), ("R", right_elapsed)]:
            times = [re.fullmatch(rf"{side}:\s*(?:(\d+)m\s*)?(\d+)s", s) for s in labels]
            found = [m for m in times if m]
            assert len(found) == 1, f"Expected one saved {side} duration"
            seconds = int(found[0][1] or 0) * 60 + int(found[0][2])
            assert seconds > 0 and abs(seconds - measured) <= 8, f"{side} timer disagrees with elapsed time"
            self.results.append(f"{side} timer saved {seconds}s, wall clock {measured:.1f}s")
        self.screen("saved-nursing-history")

    def run_flow(self, name, flow):
        self.checkpoint(name)
        recording = False
        try:
            self.driver.start_recording_screen(timeLimit=480, videoQuality="low")
            recording = True
        except WebDriverException:
            print(f"{name}: recording unavailable", flush=True)
        try:
            flow()
            self.results.append(f"PASS {name}")
            return True
        except Exception as exc:
            # Transport errors may contain the private Appium URL.
            detail = str(exc) if isinstance(exc, AssertionError) else type(exc).__name__
            self.results.append(f"FAIL {name} at {self.step}: {detail}")
            try:
                self.screen(f"{name}-failure")
            except Exception:
                pass
            return False
        finally:
            if recording:
                try:
                    data = self.driver.stop_recording_screen()
                    if data:
                        (OUT / f"{name}.mp4").write_bytes(base64.b64decode(data))
                except Exception:
                    print(f"{name}: recording could not be saved", flush=True)
            (OUT / "results.txt").write_text("\n".join(self.results) + "\n")
            print("\n".join(self.results), flush=True)


def main():
    opts = XCUITestOptions().load_capabilities(json.loads(os.environ["APPIUM_CAPS"]))
    opts.set_capability("appium:bundleId", BUNDLE)
    opts.set_capability("appium:noReset", True)
    opts.set_capability("appium:waitForIdleTimeout", 1)
    driver = webdriver.Remote(os.environ["APPIUM_URL"], options=opts)
    try:
        driver.activate_app(BUNDLE)
        device = FeedingDevice(driver)
        bottles = device.run_flow("bottle-solid", device.bottle_and_solid)
        nursing = device.run_flow("nursing", device.nursing)
        return 0 if bottles and nursing else 1
    finally:
        driver.quit()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        sys.exit(f"Appium connection or cleanup failed: {type(exc).__name__}")
