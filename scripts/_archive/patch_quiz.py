import re

with open('quiz.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update Sidebar text
sidebar_old = """        <div class="progress-item" data-step="2">
          <div class="progress-dot">2</div>
          <div>
            <div class="progress-text-title">Health Profile</div>
            <div class="progress-text-sub">Basic health information</div>
          </div>
        </div>
        <div class="progress-item" data-step="3">
          <div class="progress-dot">3</div>
          <div>
            <div class="progress-text-title">Current Symptoms</div>
            <div class="progress-text-sub">What you're experiencing</div>
          </div>
        </div>
        <div class="progress-item" data-step="4">
          <div class="progress-dot">4</div>
          <div>
            <div class="progress-text-title">Medical History</div>
            <div class="progress-text-sub">Conditions & medications</div>
          </div>
        </div>
        <div class="progress-item" data-step="5">
          <div class="progress-dot">5</div>
          <div>
            <div class="progress-text-title">Lifestyle</div>
            <div class="progress-text-sub">Habits & preferences</div>
          </div>
        </div>
        <div class="progress-item" data-step="6">
          <div class="progress-dot">6</div>
          <div>
            <div class="progress-text-title">Contact Info</div>
            <div class="progress-text-sub">Where to send your plan</div>
          </div>
        </div>"""

sidebar_new = """        <div class="progress-item" data-step="2">
          <div class="progress-dot">2</div>
          <div>
            <div class="progress-text-title">Save Progress</div>
            <div class="progress-text-sub">Where to send your results</div>
          </div>
        </div>
        <div class="progress-item" data-step="3">
          <div class="progress-dot">3</div>
          <div>
            <div class="progress-text-title">Health Profile</div>
            <div class="progress-text-sub">Basic health information</div>
          </div>
        </div>
        <div class="progress-item" data-step="4">
          <div class="progress-dot">4</div>
          <div>
            <div class="progress-text-title">Current Symptoms</div>
            <div class="progress-text-sub">What you're experiencing</div>
          </div>
        </div>
        <div class="progress-item" data-step="5">
          <div class="progress-dot">5</div>
          <div>
            <div class="progress-text-title">Medical History</div>
            <div class="progress-text-sub">Conditions & medications</div>
          </div>
        </div>
        <div class="progress-item" data-step="6">
          <div class="progress-dot">6</div>
          <div>
            <div class="progress-text-title">Lifestyle</div>
            <div class="progress-text-sub">Habits & preferences</div>
          </div>
        </div>"""

text = text.replace(sidebar_old, sidebar_new)
text = text.replace('Step 1 of 5', 'Step 1 of 6')

# We will simply find the entire block of steps
steps_pattern = re.compile(r'(<!-- STEP 1.*?)(<!-- RESULTS -->)', re.DOTALL)
steps_match = steps_pattern.search(text)
if not steps_match:
    print("Could not find steps block")
    exit(1)

steps_block = steps_match.group(1)

# Split into individual steps
step_divs = re.split(r'<!-- STEP (\d):.*?-->', steps_block)

s1 = step_divs[2]
s2 = step_divs[4]
s3 = step_divs[6]
s4 = step_divs[8]
s5 = step_divs[10]
s6 = step_divs[12]

# Move step 6 to be step 2
# So order is S1, S6, S2, S3, S4, S5

def fix_step(html, new_id_num, back_target, next_target, is_final=False, overrides=None):
    html = re.sub(r'id="step-\d+"', f'id="step-{new_id_num}"', html)
    html = re.sub(r'Step \d+ of \d+', f'Step {new_id_num} of 6', html)
    # Fix back button
    html = re.sub(r'onclick="nextStep\(\d+\)"(?=>\s*<svg width="16" height="16" viewBox="0 0 16 16" fill="none">\s*<path d="M13 8H3M7 12l-4-4 4-4")', f'onclick="nextStep({back_target})"', html)
    
    if is_final:
        # replace next button with showResults
        html = re.sub(r'<button class="quiz-next".*?</button>', '<button class="quiz-next" onclick="showResults()" style="width: 100%; justify-content: center; padding: 18px;">View My Matches & Pricing ✦</button>', html, flags=re.DOTALL)
    else:
        # fix next button
        if overrides and 'next_btn' in overrides:
             html = re.sub(r'<button class="quiz-next".*?</button>', overrides['next_btn'], html, flags=re.DOTALL)
        else:
             html = re.sub(r'onclick="nextStep\(\d+\)"(?=>\s*Continue)', f'onclick="nextStep({next_target})"', html)
             html = re.sub(r'onclick="showResults\(\)"', f'onclick="nextStep({next_target})"', html)
             # And ensure the button text is "Continue"
             html = re.sub(r'<button class="quiz-next".*?</button>', f'<button class="quiz-next" onclick="nextStep({next_target})">Continue <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg></button>', html, flags=re.DOTALL)

    return html

new_s1 = fix_step(s1, 1, 0, 2)
# Step 6 goes to Step 2
next_btn_s2 = '<button class="quiz-next" onclick="saveProgressAndContinue(3)" style="width: 100%; justify-content: center; padding: 18px;">Save & Continue <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="margin-left:8px"><path d="M3 8h10M9 4l4 4-4 4" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg></button>'
new_s2 = fix_step(s6, 2, 1, 3, False, {'next_btn': next_btn_s2})
new_s2 = new_s2.replace('Where should we send your <em>results?</em>', 'Save your <em>progress</em>')
new_s2 = new_s2.replace('We\'ll build your secure profile and instantly reveal your treatment matches and pricing.', 'Enter your details below to save your answers. You\'ll see your results at the end.')

new_s3 = fix_step(s2, 3, 2, 4)
new_s4 = fix_step(s3, 4, 3, 5)
new_s5 = fix_step(s4, 5, 4, 6)
new_s6 = fix_step(s5, 6, 5, 0, True)

new_steps_block = f"<!-- STEP 1: Goal -->{new_s1}<!-- STEP 2: Save Progress -->{new_s2}<!-- STEP 3: Health Profile -->{new_s3}<!-- STEP 4: Symptoms -->{new_s4}<!-- STEP 5: Medical History -->{new_s5}<!-- STEP 6: Lifestyle -->{new_s6}"

text = text.replace(steps_block, new_steps_block)

text = text.replace('Step ${step} of 5', 'Step ${step} of 6')

js_code = """
    function saveProgressAndContinue(nextStepNum) {
      const email = document.getElementById('contact-email').value;
      const phone = document.getElementById('contact-phone').value;
      
      if (!email || !phone) {
        alert("Please enter your email and phone number to save your progress.");
        return;
      }
      
      // Here we would typically send a webhook to Klaviyo/Make/n8n
      console.log("Saving user contact info:", email, phone);
      
      // Proceed to next step
      nextStep(nextStepNum);
    }
"""
text = text.replace('    function showResults() {', js_code + '\n    function showResults() {')

with open('quiz.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Quiz successfully updated via python script.")
