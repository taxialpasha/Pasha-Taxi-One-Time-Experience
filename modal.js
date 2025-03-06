document.addEventListener('DOMContentLoaded', function () {
    // Primera forma: Comprueba si el elemento existe antes de inicializar
    const modalElement = document.getElementById('myModal');
    if (modalElement) {
        try {
            const modalInstance = new bootstrap.Modal(modalElement);
            
            // Ejemplo de mostrar el modal (si existe el botón)
            const openButton = document.getElementById('openModalButton');
            if (openButton) {
                openButton.addEventListener('click', function () {
                    modalInstance.show();
                });
            }

            // Ejemplo de ocultar el modal (si existe el botón)
            const closeButton = document.getElementById('closeModalButton');
            if (closeButton) {
                closeButton.addEventListener('click', function () {
                    modalInstance.hide();
                });
            }
        } catch (error) {
            console.error("Error al inicializar el modal:", error);
        }
    }

    // Segunda forma: Comprueba si el elemento existe antes de inicializar
    const exampleModalElement = document.getElementById('exampleModal');
    if (exampleModalElement) {
        try {
            new bootstrap.Modal(exampleModalElement, {
                keyboard: false
            });
            
            // Para mostrar el modal si es necesario
            // myModal.show();
        } catch (error) {
            console.error("Error al inicializar exampleModal:", error);
        }
    }
});