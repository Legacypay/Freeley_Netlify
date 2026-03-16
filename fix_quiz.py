import re

with open('quiz.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Update Sidebar
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

content = content.replace(sidebar_old, sidebar_new)

# Now extract the steps
step1_match = re.search(r'(<!-- STEP 1:.*?</div>\n        </div>)', content, re.DOTALL)
step2_match = re.search(r'(<!-- STEP 2:.*?</div>\n        </div>)', content, re.DOTALL)
step3_match = re.search(r'(<!-- STEP 3:.*?</div>\n        </div>)', content, re.DOTALL)
step4_match = re.search(r'(<!-- STEP 4:.*?</div>\n        </div>)', content, re.DOTALL)
step5_match = re.search(r'(<!-- STEP 5:.*?</div>\n        </div>)', content, re.DOTALL)
step6_match = re.search(r'(<!-- STEP 6:.*?</div>\n        </div>)', content, re.DOTALL)

if step1_match and step2_match and step3_match and step4_match and step5_match and step6_match:
    s1 = step1_match.group(1)
    s2 = step2_match.group(1)
    s3 = step3_match.group(1)
    s4 = step4_match.group(1)
    s5 = step5_match.group(1)
    s6 = step6_match.group(1)
    
    # We want order: 1, 6 (as step 2), 2 (as step 3), 3 (as step 4), 4 (as step 5), 5 (as step 6)
    
    # Modify step 6 to become step 2
    new_s2 = s6.replace('id="step-6"', 'id="step-2"')
    new_s2 = new_s2.replace('Step 6 of 6', 'Step 2 of 6')
    new_s2 = new_s2.replace('onclick="nextStep(5)"', 'onclick="nextStep(1)"')
    new_s2 = new_s2.replace('onclick="showResults()"', 'onclick="saveProgressAndContinue(3)"') # We will add this function
    new_s2 = new_s2.replace('View My Matches & Pricing ✦', 'Save & Continue <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>')
    new_s2 = new_s2.replace('<!-- STEP 6: Contact -->', '<!-- STEP 2: Save Progress -->')
    new_s2 = new_s2.replace('Where should we send your <em>results?</em>', 'Where should we send your <em>results?</em>')

    # Modify step 2 to become step 3
    new_s3 = s2.replace('id="step-2"', 'id="step-3"')
    new_s3 = new_s3.replace('Step 2 of 5', 'Step 3 of 6')
    new_s3 = new_s3.replace('onclick="nextStep(1)"', 'onclick="nextStep(2)"')
    new_s3 = new_s3.replace('onclick="nextStep(3)"', 'onclick="nextStep(4)"')

    # Modify step 3 to become step 4
    new_s4 = s3.replace('id="step-3"', 'id="step-4"')
    new_s4 = new_s4.replace('Step 3 of 5', 'Step 4 of 6')
    new_s4 = new_s4.replace('onclick="nextStep(2)"', 'onclick="nextStep(3)"')
    new_s4 = new_s4.replace('onclick="nextStep(4)"', 'onclick="nextStep(5)"')

    # Modify step 4 to become step 5
    new_s5 = s4.replace('id="step-4"', 'id="step-5"')
    new_s5 = new_s5.replace('Step 4 of 5', 'Step 5 of 6')
    new_s5 = new_s5.replace('onclick="nextStep(3)"', 'onclick="nextStep(4)"')
    new_s5 = new_s5.replace('onclick="nextStep(5)"', 'onclick="nextStep(6)"')

    # Modify step 5 to become step 6
    new_s6 = s5.replace('id="step-5"', 'id="step-6"')
    new_s6 = new_s6.replace('Step 5 of 5', 'Step 6 of 6')
    new_s6 = new_s6.replace('onclick="nextStep(4)"', 'onclick="nextStep(5)"')
    new_s6 = new_s6.replace('onclick="nextStep(6)"', 'onclick="showResults()"')
    new_s6 = new_s6.replace('Continue <svg width="16" height="16" viewBox="0 0 16 16"\n                fill="none">\n                <path d="M3 8h10M9 4l4 4-4 4" stroke="white" stroke-width="1.8" stroke-linecap="round"\n                  stroke-linejoin="round" />\n              </svg>', 'View My Matches & Pricing ✦')
    new_s6 = new_s6.replace('<button class="quiz-next" onclick="showResults()">View My Matches & Pricing ✦</button>', '<button class="quiz-next" onclick="showResults()" style="width: 100%; justify-content: center; padding: 18px;">View My Matches & Pricing ✦</button>')
    # Wait, step 5 end has a specific button format, let's fix it safely
    new_s6 = re.sub(r'<button class="quiz-next" onclick="nextStep\(6\)">.*?</button>', '<button class="quiz-next" onclick="showResults()" style="width: 100%; justify-content: center; padding: 18px;">View My Matches & Pricing ✦</button>', new_s6, flags=re.DOTALL)


    # Replace the old steps block with the new one
    old_steps_block = s1 + "\n\n" + s2 + "\n\n" + s3 + "\n\n" + s4 + "\n\n" + s5 + "\n\n" + s6
    new_steps_block = s1 + "\n\n" + new_s2 + "\n\n" + new_s3 + "\n\n" + new_s4 + "\n\n" + new_s5 + "\n\n" + new_s6
    
    content = content.replace(old_steps_block, new_steps_block)

    # Change total steps in JS from 6 to 6 (it was 6 steps but labels said 5)
    # Actually totalSteps is hardcoded as 6 somewhere? Wait, let's check JS.
    content = content.replace('const totalSteps = 6;', 'const totalSteps = 6;')
    content = content.replace('document.getElementById("progressLabel").innerText = `Step ${step} of 6`;', 'document.getElementById("progressLabel").innerText = `Step ${step} of 6`;')
    
    # We need to add JS function saveProgressAndContinue
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
    content = content.replace('function showResults() {', js_code + '\n  function showResults() {')
    
    # Also find any remaining Step X of 5 and fix
    content = content.replace('Step 1 of 5', 'Step 1 of 6')
    content = content.replace('of 5`;', 'of 6`;')
    
    with open('quiz.html', 'w', encoding='utf-8') as fw:
        fw.write(content)
    print("Quiz updated successfully.")
else:
    print("Error parsing steps.")

