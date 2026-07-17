const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');

    question.addEventListener('click', () => {
        faqItems.forEach(otherItem => {
            if (otherItem !== item) {
                otherItem.classList.remove('open');
            }
        });

        item.classList.toggle('open');
    });
});


        // Mobile menu toggle
        const mobileMenuButton = document.querySelector('.navbar-toggler-custom');
        const mobileMenu = document.querySelector('.navbar-nav-custom.d-lg-none');

        if (mobileMenuButton) {
            mobileMenuButton.addEventListener('click', () => {
                if (mobileMenu.style.display === 'none') {
                    mobileMenu.style.display = 'flex';
                    mobileMenu.style.flexDirection = 'column';
                } else {
                    mobileMenu.style.display = 'none';
                }
            });
        }



const stickyBar = document.getElementById("start-assessment");

const placeholder = document.createElement("div");
stickyBar.parentNode.insertBefore(placeholder, stickyBar);

function handleSticky() {

    if (window.innerWidth >= 768) {
        stickyBar.classList.remove("mobile-fixed");
        placeholder.style.display = "none";
        return;
    }

    const rect = stickyBar.getBoundingClientRect();

    if (rect.top <= 0 && !stickyBar.classList.contains("mobile-fixed")) {

        placeholder.style.height = stickyBar.offsetHeight + "px";
        placeholder.style.display = "block";

        stickyBar.classList.add("mobile-fixed");

    } else if (window.scrollY <= placeholder.offsetTop) {

        placeholder.style.display = "none";
        stickyBar.classList.remove("mobile-fixed");

    }
}

window.addEventListener("scroll", handleSticky);
window.addEventListener("resize", handleSticky);



