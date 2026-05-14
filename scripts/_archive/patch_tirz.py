import re

with open('checkout.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Add Tirzepatide plans and Semaglutide plans resetting
tirz_block = """          currentConfig.name = 'Tirzepatide';
          currentConfig.desc = 'Compounded w/ B6 (Pyridoxine)';
          currentConfig.image = 'assets/brand/tirzz_transparent.png'; // Premium tirz vial
          currentConfig.plans = [
            { months: 1, base: 274.29, overridePrice: 274.29, recommended: false },
            { months: 3, base: 274.29, overridePrice: 214.29, recommended: false },
            { months: 6, base: 274.29, overridePrice: 194.29, recommended: true },
            { months: 12, base: 274.29, overridePrice: 174.29, recommended: false }
          ];"""

sema_block = """          currentConfig.name = 'Semaglutide';
          currentConfig.desc = 'Compounded w/ B12 (Cyanocobalamin)';
          currentConfig.image = 'assets/brand/semag_transparent.png'; // Premium sema vial
          currentConfig.plans = [
            { months: 1, base: 194.29, overridePrice: 194.29, recommended: false },
            { months: 3, base: 194.29, overridePrice: 149.29, recommended: false },
            { months: 6, base: 194.29, overridePrice: 124.29, recommended: true },
            { months: 12, base: 194.29, overridePrice: 99.29, recommended: false }
          ];"""

# Replace the specific lines inside applyCompoundParams
text = re.sub(
    r"          currentConfig\.name = 'Tirzepatide';\s+currentConfig\.desc = 'Compounded w/ B6 \(Pyridoxine\)';\s+currentConfig\.image = 'assets/brand/tirzz_transparent\.png'; // Premium tirz vial",
    tirz_block,
    text
)

text = re.sub(
    r"          currentConfig\.name = 'Semaglutide';\s+currentConfig\.desc = 'Compounded w/ B12 \(Cyanocobalamin\)';\s+currentConfig\.image = 'assets/brand/semag_transparent\.png'; // Premium sema vial",
    sema_block,
    text
)

# And because JS changes, we MUST call renderPlans() in applyCompoundParams so the UI actually updates immediately
# It is called inside setCheckoutCompound?
# setCheckoutCompound does:
# function setCheckoutCompound(type) { compoundOverride = type; applyCompoundParams(); }
# But setCheckoutCompound doesn't call renderPlans! 
# Let's add renderPlans() at the end of applyCompoundParams()
text = re.sub(
    r"(      document\.getElementById\('checkout-img'\)\.src = currentConfig\.image;\n    })",
    r"\1\n    // Render plans because prices may have changed\n    renderPlans();",
    text
)

with open('checkout.html', 'w', encoding='utf-8') as f:
    f.write(text)

with open('pricing.html', 'r', encoding='utf-8') as f:
    ptext = f.read()

# Update the pricing array for tirz
ptext = ptext.replace('tirz: 194.29', 'tirz: 274.29')
# And if there's any fallback
ptext = ptext.replace('tirz: 134', 'tirz: 274.29')

with open('pricing.html', 'w', encoding='utf-8') as f:
    f.write(ptext)

print("Tirzepatide prices patched successfully in checkout.html and pricing.html.")
