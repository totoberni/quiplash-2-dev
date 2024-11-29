# test_app.py

from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
import time
import re

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Function to set up a browser driver
def create_browser():
    options = webdriver.ChromeOptions()
    # Uncomment the line below if you want to run the browsers in headless mode
    # options.add_argument('--headless')
    options.add_argument('--start-maximized')
    driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=options)
    return driver

# User credentials
users = [
    {'username': 'testuser', 'password': 'testpassword'},
    {'username': 'testuser2', 'password': 'testpassword2'},
    {'username': 'testuser3', 'password': 'testpassword3'},
]

# Create browser instances for each user
browsers = []
for _ in users:
    browsers.append(create_browser())

# Open the web app in each browser
for browser in browsers:
    browser.get('http://localhost:8080')

# Wait times
wait_times = {'short': 5, 'medium': 10, 'long': 20}

# Login each user
for idx, browser in enumerate(browsers):
    user = users[idx]
    wait = WebDriverWait(browser, wait_times['medium'])
    # Wait for the username input to be present
    username_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'input[placeholder="Username"]')))
    # Fill in the username and password
    username_input.send_keys(user['username'])
    password_input = browser.find_element(By.CSS_SELECTOR, 'input[placeholder="Password"]')
    password_input.send_keys(user['password'])
    # Click the Login button
    login_button = browser.find_element(By.XPATH, '//button[text()="Login"]')
    login_button.click()

# Now, in the first browser (User A), create a game
browser_a = browsers[0]
wait_a = WebDriverWait(browser_a, wait_times['medium'])

# Wait for the Create Game button
create_game_button = wait_a.until(EC.element_to_be_clickable((By.XPATH, '//button[text()="Create Game"]')))
create_game_button.click()

# Wait for the game code to be displayed
# Assuming the game code is displayed in an element with class 'alert-success' or similar
game_code_element = wait_a.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.alert-success')))
game_code_text = game_code_element.text

# Extract the game code from the text
match = re.search(r'Game created with code: (\w+)', game_code_text)
if match:
    game_code = match.group(1)
    print(f'Game code is: {game_code}')
else:
    print('Game code not found')
    exit(1)

# In the other browsers (Users B and C), join the game using the game code
for browser in browsers[1:]:
    wait = WebDriverWait(browser, wait_times['medium'])
    # Wait for the Join Game button
    join_game_button = wait.until(EC.element_to_be_clickable((By.XPATH, '//button[text()="Join Game"]')))
    join_game_button.click()
    # Wait for the input field to appear
    game_code_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'input[placeholder="Enter Game Code"]')))
    game_code_input.send_keys(game_code)
    # Click the Submit button
    submit_button = browser.find_element(By.XPATH, '//button[text()="Submit"]')
    submit_button.click()

# Wait for all browsers to reach the prompt submission phase
# You may need to adjust the sleep time based on your application's timing
time.sleep(5)

# Now, all users submit the prompt 'what is your favourite color of the week'
prompt_text = 'what is your favourite color of the week'

for browser in browsers:
    wait = WebDriverWait(browser, wait_times['medium'])
    # Wait for the prompt input to appear
    try:
        prompt_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'input[placeholder="Enter your prompt"]')))
        prompt_input.send_keys(prompt_text)
        # Click the Submit Prompt button
        submit_prompt_button = browser.find_element(By.XPATH, '//button[text()="Submit Prompt"]')
        submit_prompt_button.click()
    except Exception as e:
        print(f'Error submitting prompt in one of the browsers: {e}')

# Optionally, you can close the browsers after testing
time.sleep(10)  # Wait for a while to observe the results
for browser in browsers:
    browser.quit()