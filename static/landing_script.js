document.addEventListener('DOMContentLoaded', () => {
    // Step hover animations
    const steps = document.querySelectorAll('.step');
    steps.forEach(step => {
        step.addEventListener('mouseenter', () => {
            step.style.transform = 'translateY(-2px)';
        });
        step.addEventListener('mouseleave', () => {
            step.style.transform = 'translateY(0)';
        });
    });

    // FAQ toggle functionality
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        item.addEventListener('click', () => {
            const wasActive = item.classList.contains('active');
            
            // Close all FAQ items
            faqItems.forEach(faqItem => {
                faqItem.classList.remove('active');
                faqItem.querySelector('.toggle').textContent = '+';
            });

            // Toggle clicked item if it wasn't active
            if (!wasActive) {
                item.classList.add('active');
                item.querySelector('.toggle').textContent = '-';
            }
        });
    });

    // Smooth scroll for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Add loading animation to CTA button
    const ctaButton = document.querySelector('.cta-button');
    ctaButton.addEventListener('click', function(e) {
        e.preventDefault();
        this.style.opacity = '0.7';
        this.textContent = 'Loading...';
        setTimeout(() => {
            this.style.opacity = '1';
            this.textContent = 'Get started';
            window.location.href = "/app"
        }, 1500);
    });
});
