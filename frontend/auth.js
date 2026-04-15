document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent full page reload to demonstrate frontend logic
            
            const submitBtn = form.querySelector('button[type="submit"]');
            
            if (submitBtn) {
                const originalText = submitBtn.innerText;
                submitBtn.innerText = "Please wait...";
                submitBtn.disabled = true;
                
                // Simulate authentication / network request
                setTimeout(() => {
                    submitBtn.innerText = originalText;
                    submitBtn.disabled = false;
                    
                    // Redirect back to main dashboard (for prototype/demo purposes)
                    window.location.href = 'index.html';
                }, 1500);
            }
        });
    });
});
