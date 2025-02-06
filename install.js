let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  const installBtn = document.createElement('button');
  installBtn.classList.add('install-button');  
  installBtn.textContent = 'تثبيت التطبيق';
  document.body.appendChild(installBtn);
  
  installBtn.addEventListener('click', async () => {
    installBtn.style.display = 'none';
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    deferredPrompt = null;
  });
});

window.addEventListener('appinstalled', (evt) => {
  console.log('Application was successfully installed');
});