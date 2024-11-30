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
    {'username': 'testuser4', 'password': 'testpassword4'},
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
    print(f"Browser {idx + 1} logged in as {user['username']}.")

# Now, in the first browser (User A), create a game
browser_a = browsers[0]
wait_a = WebDriverWait(browser_a, wait_times['medium'])

# Wait for the Create Game button
create_game_button = wait_a.until(EC.element_to_be_clickable((By.XPATH, '//button[text()="Create Game"]')))
create_game_button.click()

# Wait for the game code to be displayed
# Assuming the game code is displayed in an element with class 'alert-success' or similar
game_code_element = wait_a.until(EC.presence_of_element_located((By.CSS_SELECTOR, '.alert.alert-success, .alert-success')))
game_code_text = game_code_element.text

# Extract the game code from the text
match = re.search(r'Game created with code: (\w+)', game_code_text)
if match:
    game_code = match.group(1)
    print(f'Game code is: {game_code}')
else:
    print('Game code not found')
    exit(1)

# In the other browsers, join the game using the game code
for idx, browser in enumerate(browsers[1:], start=1):
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
    print(f"Browser {idx + 1} joined the game with code {game_code}.")

# Wait for all browsers to reach the prompt submission phase
time.sleep(5)  # Adjust the sleep time based on your application's timing

# Now, all users submit the prompt 'What is your favorite hobby?'
prompt_text = 'What is your favorite hobby?'

for idx, browser in enumerate(browsers):
    wait = WebDriverWait(browser, wait_times['medium'])
    # Wait for the prompt input to appear
    try:
        prompt_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'input[placeholder="Enter your prompt"]')))
        prompt_input.send_keys(prompt_text)
        # Click the Submit Prompt button
        submit_prompt_button = browser.find_element(By.XPATH, '//button[text()="Submit Prompt"]')
        submit_prompt_button.click()
        print(f"Browser {idx + 1} submitted a prompt.")
    except Exception as e:
        print(f'Error submitting prompt in browser {idx + 1}: {e}')

# Wait for the game to progress to the 'Submit Your Answers' phase
time.sleep(10)  # Adjust the sleep time based on your application's timing

# Now, each user submits the answer 'long I have dwelled in the dark before gleaming at the sun' for each of their prompts
answer_text = 'long I have dwelled in the dark before gleaming at the sun'

for idx, browser in enumerate(browsers):
    wait = WebDriverWait(browser, wait_times['long'])
    try:
        # Wait for the 'Submit Your Answers' heading to appear
        wait.until(EC.presence_of_element_located((By.XPATH, '//h3[contains(text(), "Submit Your Answers")]')))

        # Find all answer input fields
        answer_inputs = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, 'input[placeholder="Your answer"]')))
        # Submit the answer in each input field
        for answer_input in answer_inputs:
            answer_input.send_keys(answer_text)
        # Click the Submit Answers button
        submit_answers_button = browser.find_element(By.XPATH, '//button[text()="Submit Answers"]')
        submit_answers_button.click()
        print(f"Browser {idx + 1} submitted {len(answer_inputs)} answers.")
    except Exception as e:
        print(f'Error submitting answers in browser {idx + 1}: {e}')

# Wait for the game to progress to the voting phase
time.sleep(10)  # Adjust the sleep time based on your application's timing

# Now, simulate voting
# Each browser will vote for an answer that is not their own

for idx, browser in enumerate(browsers):
    wait = WebDriverWait(browser, wait_times['long'])
    try:
        # Wait for the 'Vote for the Best Answer' heading to appear
        wait.until(EC.presence_of_element_located((By.XPATH, '//h3[contains(text(), "Vote for the Best Answer")]')))

        # Wait for voting options to be present
        voting_options = wait.until(EC.presence_of_all_elements_located((By.CSS_SELECTOR, '.proportional-box.voting-option')))

        # Get the current player's username
        user = users[idx]
        username = user['username']

        # Collect valid voting options (exclude own answers)
        valid_options = []
        for i, option in enumerate(voting_options):
            # Extract the answerUsername from the option
            answer_by_element = option.find_element(By.XPATH, './/p[strong[text()="Answer by:"]]')
            answer_username = answer_by_element.text.replace('Answer by:', '').strip()
            if answer_username != username:
                valid_options.append((i, option))

        if not valid_options:
            print(f"Browser {idx + 1}: No valid options to vote for (cannot vote for own answer).")
            continue

        # Select the first valid option (or you can randomize)
        choice_index, voting_option = valid_options[0]
        browser.execute_script("arguments[0].scrollIntoView();", voting_option)
        voting_option.click()

        # Wait for the 'Submit Vote' button to appear
        submit_vote_button = wait.until(EC.element_to_be_clickable((By.XPATH, '//button[text()="Submit Vote"]')))
        submit_vote_button.click()
        print(f"Browser {idx + 1} voted for option {choice_index + 1}")
    except Exception as e:
        print(f'Error during voting in browser {idx + 1}: {e}')

# At this point, the browsers should not be closed so you can inspect the results
print("Votes submitted. Browsers remain open for inspection.")

# Optional: Keep the browsers open indefinitely or for a set amount of time
# Uncomment the line below to keep browsers open indefinitely
input("Press Enter to close the browsers...")

# Or keep browsers open for a specific duration
# time.sleep(300)  # Keep browsers open for 5 minutes

# If you decide to close the browsers after inspection
for browser in browsers:
    browser.quit()
