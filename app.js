<<<<<<< HEAD
import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const INVENTORY_COLLECTION = 'atelier_inventory';
let inventory = [];
let activeCategory = 'all';
let editingId = null;
let currentGallery = [];
let currentGalleryIndex = 0;
let currentImagesBase64 = [];

const UI = {
    navItems: document.querySelectorAll('.nav-item'), views: document.querySelectorAll('.view-section'),
    grid: document.getElementById('product-grid'), modalProd: document.getElementById('modal-product'),
    modImg: document.getElementById('mod-img'), modName: document.getElementById('mod-name'),
    modPrice: document.getElementById('mod-price'), modDesc: document.getElementById('mod-desc'),
    modStatus: document.getElementById('mod-status-tag'), adminTrigger: document.getElementById('admin-trigger'),
    modalLogin: document.getElementById('modal-login'), 
    inpEmail: document.getElementById('inp-email'), // Nuevo
    inpPass: document.getElementById('inp-pass'),
    btnLogin: document.getElementById('btn-login'), btnLogout: document.getElementById('btn-logout'),
    formProduct: document.getElementById('form-product'), closeBtns: document.querySelectorAll('.close-btn'),
    inpFile: document.getElementById('inp-file'), fileLabel: document.getElementById('file-label-display'),
    btnSubmit: document.getElementById('btn-submit'), category: document.getElementById('inp-category'),
    adminList: document.getElementById('admin-product-list'), cancelEdit: document.getElementById('btn-cancel-edit'),
    sort: document.getElementById('sort-products'), filters: document.querySelectorAll('.filter-btn'),
    galleryPrev: document.getElementById('gallery-prev'), galleryNext: document.getElementById('gallery-next'),
    galleryDots: document.getElementById('gallery-dots'), globalLoader: document.getElementById('global-loader')
};

// --- SEGURIDAD: VERIFICACIÓN DE SESIÓN ---
// Evita que un intruso vea la pantalla de admin incluso si manipula el HTML
onAuthStateChanged(auth, (user) => {
    if (!user && document.getElementById('view-admin').classList.contains('active')) {
        switchView('view-home');
    }
});

async function fetchInventoryFromCloud() {
    try {
        if(UI.globalLoader) UI.globalLoader.classList.remove('hidden');
        const querySnapshot = await getDocs(collection(db, INVENTORY_COLLECTION));
        inventory = [];
        querySnapshot.forEach((doc) => {
            inventory.push({ id: doc.id, ...doc.data() });
        });
        renderGrid();
        renderAdminList();
    } catch (error) {
        console.error("Error obteniendo datos:", error);
    } finally {
        if(UI.globalLoader) UI.globalLoader.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');
    fetchInventoryFromCloud();
    setupNavScroll();
    setupParallax();
    initReveal();
});

function switchView(targetId) {
    if(!UI.views) return;
    UI.navItems.forEach(btn => btn.classList.toggle('active', btn.dataset.target === targetId));
    UI.views.forEach(view => {
        if(view.id === targetId) { 
            view.classList.remove('hidden'); 
            setTimeout(() => view.style.opacity = '1', 50); 
        } else { 
            view.classList.add('hidden'); 
            view.style.opacity = '0'; 
        }
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
UI.navItems.forEach(btn => btn.addEventListener('click', (e) => switchView(e.target.dataset.target)));

function renderGrid() {
    if(!UI.grid) return;
    UI.grid.innerHTML = '';
    const sortValue = UI.sort ? UI.sort.value : 'date-desc';
    const products = inventory
        .filter(item => activeCategory === 'all' || item.category === activeCategory)
        .sort((first, second) => {
            if (sortValue === 'price-asc') return first.price - second.price;
            if (sortValue === 'price-desc') return second.price - first.price;
            const dateOrder = Number(first.createdAt) - Number(second.createdAt);
            return sortValue === 'date-asc' ? dateOrder : -dateOrder;
        })
        .sort((first, second) => Number(first.status === 'sold') - Number(second.status === 'sold'));
    
    products.forEach(item => {
        const isSold = item.status === 'sold';
        const card = document.createElement('div');
        card.className = `product-card ${isSold ? 'is-sold' : ''}`;
        card.innerHTML = `
            <div class="card-img-wrapper">
                ${isSold ? '<div class="sold-badge">VENDIDA</div>' : ''}
                <img src="${item.image}" alt="${item.name}">
            </div>
            <div class="card-meta">
                <div><small>${item.category}</small><h3>${item.name}</h3></div><span>$${item.price.toLocaleString()}</span>
            </div>
        `;
        card.addEventListener('click', () => openProduct(item));
        UI.grid.appendChild(card);
    });
    initReveal(UI.grid);
}

function renderAdminList() {
    if (!UI.adminList) return;
    UI.adminList.innerHTML = '';
    inventory.slice().sort((first, second) => second.createdAt - first.createdAt).forEach(item => {
        const row = document.createElement('div');
        row.className = 'admin-product-row';
        row.innerHTML = `<div><strong>${item.name}</strong><span>${item.category} · $${item.price.toLocaleString()} · ${item.status === 'sold' ? 'Vendida' : 'Disponible'}</span></div><div class="admin-row-actions"><button class="btn-text edit-product" type="button">Editar</button><button class="btn-text delete-product" type="button">Borrar</button></div>`;
        row.querySelector('.edit-product').addEventListener('click', () => startEditing(item));
        row.querySelector('.delete-product').addEventListener('click', () => deleteProduct(item.id, item.name));
        UI.adminList.appendChild(row);
    });
}

async function deleteProduct(id, name) {
    if (!auth.currentUser) return alert("Acceso denegado. La sesión expiró.");
    if (!confirm(`¿Borrar "${name}" permanentemente de la bóveda?`)) return;
    try {
        UI.globalLoader.classList.remove('hidden');
        await deleteDoc(doc(db, INVENTORY_COLLECTION, id));
        await fetchInventoryFromCloud();
    } catch (error) {
        alert("Fallo de seguridad. Careces de los privilegios necesarios.");
    } finally {
        UI.globalLoader.classList.add('hidden');
    }
}

if(UI.formProduct) {
    UI.formProduct.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return alert("Acceso denegado.");
        if(!currentImagesBase64.length && !editingId) return alert('La imagen es el alma de la pieza. Requerida.');

        const productData = {
            name: document.getElementById('inp-name').value.trim(),
            price: parseFloat(document.getElementById('inp-price').value), 
            desc: document.getElementById('inp-desc').value.trim(), 
            status: document.getElementById('inp-status').value,
            category: UI.category.value
        };

        if(currentImagesBase64.length) {
            productData.image = currentImagesBase64[0];
            productData.images = currentImagesBase64;
        }

        try {
            UI.btnSubmit.disabled = true;
            UI.globalLoader.classList.remove('hidden');
            
            if (editingId) {
                await updateDoc(doc(db, INVENTORY_COLLECTION, editingId), productData);
                alert('Pieza afinada y sincronizada.');
            } else {
                productData.createdAt = Date.now();
                await addDoc(collection(db, INVENTORY_COLLECTION), productData);
                alert('Instrumento inmortalizado en la nube.');
            }
            resetProductForm();
            await fetchInventoryFromCloud();
        } catch (error) {
            alert("El servidor rechazó la ofrenda. Verifica tus permisos o el peso de la imagen.");
        } finally {
            UI.btnSubmit.disabled = false;
            UI.globalLoader.classList.add('hidden');
        }
    });
}

function startEditing(item) {
    editingId = item.id;
    document.getElementById('inp-name').value = item.name;
    document.getElementById('inp-price').value = item.price;
    UI.category.value = item.category;
    document.getElementById('inp-desc').value = item.desc;
    document.getElementById('inp-status').value = item.status;
    
    currentImagesBase64 = []; 
    UI.inpFile.required = false;
    UI.fileLabel.textContent = 'Conservar imagen actual o purgarla';
    UI.btnSubmit.textContent = 'Sobrescribir Registro';
    UI.cancelEdit.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetProductForm() {
    UI.formProduct.reset();
    editingId = null;
    currentImagesBase64 = [];
    UI.inpFile.required = true;
    UI.fileLabel.textContent = 'Seleccionar Imagen';
    UI.fileLabel.style.color = 'var(--light)';
    UI.fileLabel.style.backgroundColor = 'transparent';
    UI.btnSubmit.textContent = 'Añadir al Inventario';
    UI.cancelEdit.classList.add('hidden');
}

if (UI.cancelEdit) UI.cancelEdit.addEventListener('click', resetProductForm);

function openProduct(item) {
    currentGallery = Array.isArray(item.images) && item.images.length ? item.images : [item.image];
    currentGalleryIndex = 0;
    renderGallery();
    UI.modName.textContent = item.name;
    UI.modPrice.textContent = `$${item.price.toLocaleString()}`; UI.modDesc.textContent = item.desc;
    UI.modStatus.textContent = item.status === 'sold' ? 'Colección Privada' : 'Disponible';
    UI.modStatus.style.color = item.status === 'sold' ? 'var(--bg-dark)' : 'var(--bg-dark)';
    UI.modStatus.style.backgroundColor = item.status === 'sold' ? 'var(--accent)' : 'var(--light)';
    UI.modalProd.classList.remove('hidden');
}

function renderGallery() {
    UI.modImg.src = currentGallery[currentGalleryIndex];
    const hasMultiple = currentGallery.length > 1;
    UI.galleryPrev.classList.toggle('hidden', !hasMultiple);
    UI.galleryNext.classList.toggle('hidden', !hasMultiple);
    UI.galleryDots.innerHTML = '';
    currentGallery.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.className = `gallery-dot ${index === currentGalleryIndex ? 'active' : ''}`;
        dot.addEventListener('click', () => { currentGalleryIndex = index; renderGallery(); });
        UI.galleryDots.appendChild(dot);
    });
}

function moveGallery(dir) {
    if (currentGallery.length < 2) return;
    currentGalleryIndex = (currentGalleryIndex + dir + currentGallery.length) % currentGallery.length;
    renderGallery();
}

UI.galleryPrev.addEventListener('click', () => moveGallery(-1));
UI.galleryNext.addEventListener('click', () => moveGallery(1));
UI.closeBtns.forEach(btn => btn.addEventListener('click', (e) => e.target.closest('.overlay').classList.add('hidden')));
window.addEventListener('click', (e) => { if(e.target.classList.contains('overlay')) e.target.classList.add('hidden'); });

// --- LOGIN ENCRIPTADO ---
if(UI.adminTrigger) {
    UI.adminTrigger.addEventListener('dblclick', () => {
        UI.modalLogin.classList.remove('hidden'); UI.inpEmail.value = ''; UI.inpPass.value = '';
        setTimeout(() => UI.inpEmail.focus(), 100);
    });
}

if(UI.btnLogin) {
    UI.btnLogin.addEventListener('click', async () => {
        if (!UI.inpEmail.value || !UI.inpPass.value) return;
        try {
            if(UI.globalLoader) UI.globalLoader.classList.remove('hidden');
            // Criptografía asíncrona contra Google
            await signInWithEmailAndPassword(auth, UI.inpEmail.value, UI.inpPass.value);
            UI.modalLogin.classList.add('hidden'); 
            UI.navItems.forEach(btn => btn.classList.remove('active')); 
            switchView('view-admin');
        } catch (error) {
            alert('Huella irreconocible. La bóveda permanece cerrada.');
        } finally {
            if(UI.globalLoader) UI.globalLoader.classList.add('hidden');
        }
    });
}

if(UI.btnLogout) {
    UI.btnLogout.addEventListener('click', async () => {
        await signOut(auth); // Destruye la sesión
        switchView('view-home');
    });
}

if(UI.inpFile) {
    UI.inpFile.addEventListener('change', function(e) {
        const files = [...e.target.files];
        if(files.length) {
            UI.fileLabel.textContent = `Procesando ${files.length} foto(s)...`;
            currentImagesBase64 = [];
            Promise.all(files.map(compressImage)).then(images => {
                currentImagesBase64 = images;
                UI.fileLabel.textContent = `${files.length} foto(s) lista(s)`;
                UI.fileLabel.style.color = 'var(--bg-dark)';
                UI.fileLabel.style.backgroundColor = 'var(--accent)';
            }).catch(() => {
                UI.fileLabel.textContent = 'Error. La madera resiste.';
            });
        }
    });
}

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onerror = reject;
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onerror = reject;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; 
                const scaleSize = Math.min(1, MAX_WIDTH / img.width);
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
        };
    });
}

UI.filters.forEach(btn => btn.addEventListener('click', () => {
    activeCategory = btn.dataset.category;
    UI.filters.forEach(f => f.classList.toggle('active', f === btn));
    renderGrid();
}));
if (UI.sort) UI.sort.addEventListener('change', renderGrid);

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

function initReveal(root = document) {
    const elements = root.querySelectorAll('.reveal:not(.reveal-bound)');
    elements.forEach((el, i) => {
        el.classList.add('reveal-bound');
        if (!el.style.transitionDelay) el.style.transitionDelay = `${Math.min(i, 8) * 70}ms`;
        revealObserver.observe(el);
    });
}

=======
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    const STORAGE_KEY = 'atelier_luthier_data';
    const ADMIN_PASS = 'keke';

    // Imágenes por defecto
    const defaultGuitars = [
        { id: 'g1', name: 'Les Paul Custom \'59 Replica', price: 6500, image: 'https://images.unsplash.com/photo-1550226891-ef816aed4eca?auto=format&fit=crop&w=800&q=80', desc: 'Caoba maciza, tapa de arce tallada. Un sustain infinito que resuena en el pecho.', status: 'available', category: 'guitarra', createdAt: Date.now() - 2 },
        { id: 'g2', name: 'Fender Telecaster Relic', price: 4200, image: 'https://images.unsplash.com/photo-1514649923863-ceaf75b770ab?auto=format&fit=crop&w=800&q=80', desc: 'El twang clásico. Mástil en forma de U profunda, radio de 9.5".', status: 'sold', category: 'guitarra', createdAt: Date.now() - 1 },
        { id: 'g3', name: 'Martin D-28 Acoustic', price: 3800, image: 'https://images.unsplash.com/photo-1525201548942-d8732f6617a0?auto=format&fit=crop&w=800&q=80', desc: 'Palisandro de las Indias Orientales y abeto Sitka. Resonancia acústica pura.', status: 'available', category: 'guitarra', createdAt: Date.now() }
    ];

    let inventory = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!inventory || !Array.isArray(inventory)) {
        inventory = defaultGuitars;
    }
    inventory = inventory.map((item, index) => ({
        ...item,
        category: item.category || 'guitarra',
        createdAt: Number(item.createdAt) || Date.now() - (inventory.length - index)
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));

    const UI = {
        navItems: document.querySelectorAll('.nav-item'), views: document.querySelectorAll('.view-section'),
        grid: document.getElementById('product-grid'), modalProd: document.getElementById('modal-product'),
        modImg: document.getElementById('mod-img'), modName: document.getElementById('mod-name'),
        modPrice: document.getElementById('mod-price'), modDesc: document.getElementById('mod-desc'),
        modStatus: document.getElementById('mod-status-tag'), adminTrigger: document.getElementById('admin-trigger'),
        modalLogin: document.getElementById('modal-login'), inpPass: document.getElementById('inp-pass'),
        btnLogin: document.getElementById('btn-login'), btnLogout: document.getElementById('btn-logout'),
        formProduct: document.getElementById('form-product'), closeBtns: document.querySelectorAll('.close-btn'),
        inpFile: document.getElementById('inp-file'), fileLabel: document.getElementById('file-label-display'),
        btnSubmit: document.getElementById('btn-submit'), category: document.getElementById('inp-category'),
        adminList: document.getElementById('admin-product-list'), cancelEdit: document.getElementById('btn-cancel-edit'),
        sort: document.getElementById('sort-products'), filters: document.querySelectorAll('.filter-btn'),
        galleryPrev: document.getElementById('gallery-prev'), galleryNext: document.getElementById('gallery-next'),
        galleryDots: document.getElementById('gallery-dots')
    };
    let activeCategory = 'all';
    let editingId = null;
    let currentGallery = [];
    let currentGalleryIndex = 0;

    // --- MANEJO DE VISTAS (Scroll Inteligente) ---
    function switchView(targetId) {
        if(!UI.views) return;
        UI.navItems.forEach(btn => btn.classList.toggle('active', btn.dataset.target === targetId));
        UI.views.forEach(view => {
            if(view.id === targetId) { 
                view.classList.remove('hidden'); 
                setTimeout(() => view.style.opacity = '1', 50); 
            } else { 
                view.classList.add('hidden'); 
                view.style.opacity = '0'; 
            }
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if(targetId === 'view-collection') renderGrid();
        if(targetId === 'view-admin') renderAdminList();
    }

    UI.navItems.forEach(btn => btn.addEventListener('click', (e) => switchView(e.target.dataset.target)));

    // --- RENDERIZADO DEL CATÁLOGO ---
    function renderGrid() {
        if(!UI.grid) return;
        UI.grid.innerHTML = '';
        const sortValue = UI.sort ? UI.sort.value : 'date-desc';
        const products = inventory
            .filter(item => activeCategory === 'all' || item.category === activeCategory)
            .sort((first, second) => {
                if (sortValue === 'price-asc') return first.price - second.price;
                if (sortValue === 'price-desc') return second.price - first.price;
                const dateOrder = Number(first.createdAt) - Number(second.createdAt);
                return sortValue === 'date-asc' ? dateOrder : -dateOrder;
            })
            .sort((first, second) => Number(first.status === 'sold') - Number(second.status === 'sold'));
        products.forEach(item => {
            const isSold = item.status === 'sold';
            const card = document.createElement('div');
            card.className = `product-card ${isSold ? 'is-sold' : ''}`;
            card.innerHTML = `
                <div class="card-img-wrapper">
                    ${isSold ? '<div class="sold-badge">VENDIDA</div>' : ''}
                    <img src="${item.image}" alt="${item.name}">
                </div>
                <div class="card-meta">
                    <div><small>${item.category}</small><h3>${item.name}</h3></div><span>$${item.price.toLocaleString()}</span>
                </div>
            `;
            card.addEventListener('click', () => openProduct(item));
            UI.grid.appendChild(card);
        });
        if (typeof initReveal === 'function') initReveal(UI.grid);
    }

    function renderAdminList() {
        if (!UI.adminList) return;
        UI.adminList.innerHTML = '';
        inventory.slice().sort((first, second) => second.createdAt - first.createdAt).forEach(item => {
            const row = document.createElement('div');
            row.className = 'admin-product-row';
            row.innerHTML = `<div><strong>${item.name}</strong><span>${item.category} · $${item.price.toLocaleString()} · ${item.status === 'sold' ? 'Vendida' : 'Disponible'}</span></div><div class="admin-row-actions"><button class="btn-text edit-product" type="button">Editar</button><button class="btn-text delete-product" type="button">Borrar</button></div>`;
            row.querySelector('.edit-product').addEventListener('click', () => startEditing(item));
            row.querySelector('.delete-product').addEventListener('click', () => deleteProduct(item.id));
            UI.adminList.appendChild(row);
        });
    }

    function saveInventory() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
    }

    function startEditing(item) {
        editingId = item.id;
        document.getElementById('inp-name').value = item.name;
        document.getElementById('inp-price').value = item.price;
        UI.category.value = item.category;
        document.getElementById('inp-desc').value = item.desc;
        document.getElementById('inp-status').value = item.status;
        currentImagesBase64 = Array.isArray(item.images) && item.images.length ? item.images.slice() : [item.image];
        UI.inpFile.required = false;
        UI.fileLabel.textContent = 'Conservar imagen actual o seleccionar otra';
        UI.btnSubmit.textContent = 'Guardar cambios';
        UI.cancelEdit.classList.remove('hidden');
        document.getElementById('inp-name').focus();
    }

    function resetProductForm() {
        UI.formProduct.reset();
        editingId = null;
        currentImagesBase64 = [];
        UI.inpFile.required = false;
        UI.fileLabel.textContent = 'Seleccionar Imagen';
        UI.fileLabel.style.color = 'var(--light)';
        UI.fileLabel.style.backgroundColor = 'transparent';
        UI.btnSubmit.textContent = 'Añadir al Inventario';
        UI.cancelEdit.classList.add('hidden');
    }

    function deleteProduct(id) {
        const product = inventory.find(item => item.id === id);
        if (!product || !confirm(`¿Borrar "${product.name}" del inventario?`)) return;
        inventory = inventory.filter(item => item.id !== id);
        saveInventory();
        renderAdminList();
        renderGrid();
    }

    // --- MODALES ---
    function openProduct(item) {
        currentGallery = Array.isArray(item.images) && item.images.length ? item.images : [item.image];
        currentGalleryIndex = 0;
        renderGallery();
        UI.modName.textContent = item.name;
        UI.modPrice.textContent = `$${item.price.toLocaleString()}`; UI.modDesc.textContent = item.desc;
        UI.modStatus.textContent = item.status === 'sold' ? 'Colección Privada (Vendida)' : 'Disponible';
        UI.modStatus.style.color = item.status === 'sold' ? 'var(--bg-dark)' : 'var(--bg-dark)';
        UI.modStatus.style.backgroundColor = item.status === 'sold' ? 'var(--accent)' : 'var(--light)';
        UI.modalProd.classList.remove('hidden');
    }

    function renderGallery() {
        UI.modImg.src = currentGallery[currentGalleryIndex];
        UI.modImg.alt = `Foto ${currentGalleryIndex + 1} del producto`;
        const hasMultiple = currentGallery.length > 1;
        UI.galleryPrev.classList.toggle('hidden', !hasMultiple);
        UI.galleryNext.classList.toggle('hidden', !hasMultiple);
        UI.galleryDots.innerHTML = '';
        currentGallery.forEach((image, index) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = `gallery-dot ${index === currentGalleryIndex ? 'active' : ''}`;
            dot.setAttribute('aria-label', `Ver foto ${index + 1}`);
            dot.addEventListener('click', () => {
                currentGalleryIndex = index;
                renderGallery();
            });
            UI.galleryDots.appendChild(dot);
        });
    }

    function moveGallery(direction) {
        if (currentGallery.length < 2) return;
        currentGalleryIndex = (currentGalleryIndex + direction + currentGallery.length) % currentGallery.length;
        renderGallery();
    }

    UI.closeBtns.forEach(btn => btn.addEventListener('click', (e) => e.target.closest('.overlay').classList.add('hidden')));
    window.addEventListener('click', (e) => { if(e.target.classList.contains('overlay')) e.target.classList.add('hidden'); });

    // --- ADMIN LOGIN ---
    if(UI.adminTrigger) {
        UI.adminTrigger.addEventListener('dblclick', () => {
            UI.modalLogin.classList.remove('hidden'); UI.inpPass.value = ''; setTimeout(() => UI.inpPass.focus(), 100);
        });
    }

    if(UI.btnLogin) {
        UI.btnLogin.addEventListener('click', () => {
            if(UI.inpPass.value === ADMIN_PASS) {
                UI.modalLogin.classList.add('hidden'); UI.navItems.forEach(btn => btn.classList.remove('active')); switchView('view-admin');
            } else { alert('Firma incorrecta. Acceso denegado.'); }
        });
    }
    if(UI.btnLogout) UI.btnLogout.addEventListener('click', () => switchView('view-home'));

    // --- MOTOR DE COMPRESIÓN Y SUBIDA DE IMÁGENES ---
    let currentImagesBase64 = [];

    // Cambiar el texto del botón al elegir una foto
    if(UI.inpFile) {
        UI.inpFile.addEventListener('change', function(e) {
            const files = [...e.target.files];
            if(files.length) {
                UI.fileLabel.textContent = `${files.length} foto${files.length === 1 ? '' : 's'} cargada${files.length === 1 ? '' : 's'}`;
                UI.fileLabel.style.color = 'var(--bg-dark)';
                UI.fileLabel.style.backgroundColor = 'var(--accent)';
                currentImagesBase64 = [];
                Promise.all(files.map(compressImage)).then(images => {
                    currentImagesBase64 = images;
                });
            }
        });
    }

    // Algoritmo matemático para encoger la imagen
    function compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onerror = reject;
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onerror = reject;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const scaleSize = Math.min(1, MAX_WIDTH / img.width);
                    canvas.width = img.width * scaleSize;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
            };
        });
    }

    // --- GUARDAR INSTRUMENTO ---
    if(UI.formProduct) {
        UI.formProduct.addEventListener('submit', (e) => {
            e.preventDefault();
            
            if(!currentImagesBase64.length) {
                alert('La imagen aún se está procesando o no has seleccionado ninguna.');
                return;
            }

            const productData = {
                name: document.getElementById('inp-name').value.trim(),
                price: parseFloat(document.getElementById('inp-price').value), 
                image: currentImagesBase64[0],
                images: currentImagesBase64,
                desc: document.getElementById('inp-desc').value.trim(), 
                status: document.getElementById('inp-status').value,
                category: UI.category.value
            };
            
            try {
                if (editingId) {
                    const product = inventory.find(item => item.id === editingId);
                    Object.assign(product, productData);
                    alert('Pieza actualizada correctamente.');
                } else {
                    inventory.push({ ...productData, id: 'g_' + Date.now(), createdAt: Date.now() });
                    alert('Pieza añadida al catálogo exitosamente.');
                }
                saveInventory();
                resetProductForm();
                renderAdminList();
                renderGrid();
            } catch (error) {
                alert("Error de Almacenamiento: El almacenamiento local está lleno. Elimina datos del navegador o usa una foto menos pesada.");
            }
        });
    }
    UI.filters.forEach(button => button.addEventListener('click', () => {
        activeCategory = button.dataset.category;
        UI.filters.forEach(filter => filter.classList.toggle('active', filter === button));
        renderGrid();
    }));
    if (UI.sort) UI.sort.addEventListener('change', renderGrid);
    if (UI.cancelEdit) UI.cancelEdit.addEventListener('click', resetProductForm);
    UI.galleryPrev.addEventListener('click', () => moveGallery(-1));
    UI.galleryNext.addEventListener('click', () => moveGallery(1));
    renderGrid();
});

// ---------- Reveal on scroll ----------
const revealObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                revealObserver.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
);

function initReveal(root = document) {
    const elements = root.querySelectorAll('.reveal:not(.reveal-bound)');
    elements.forEach((element, index) => {
        element.classList.add('reveal-bound');
        if (!element.style.transitionDelay) {
            element.style.transitionDelay = `${Math.min(index, 8) * 70}ms`;
        }
        revealObserver.observe(element);
    });
}

// ---------- Nav con fondo/blur al scrollear ----------
>>>>>>> 4b5564430443db83184e133173b37a1bcc0020d9
function setupNavScroll() {
    const nav = document.querySelector('.sidebar');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('nav-scrolled', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

<<<<<<< HEAD
=======
// ---------- Parallax suave para elementos [data-parallax] ----------
>>>>>>> 4b5564430443db83184e133173b37a1bcc0020d9
function setupParallax() {
    const elements = document.querySelectorAll('[data-parallax]');
    if (!elements.length) return;
    const onScroll = () => {
<<<<<<< HEAD
        elements.forEach((el) => {
            const speed = parseFloat(el.dataset.parallax) || 0.025;
            el.style.transform = `translateY(${window.scrollY * speed}px)`;
=======
        elements.forEach((element) => {
            const speed = parseFloat(element.dataset.parallax) || 0.025;
            element.style.transform = `translateY(${window.scrollY * speed}px)`;
>>>>>>> 4b5564430443db83184e133173b37a1bcc0020d9
        });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
<<<<<<< HEAD
}
=======
}

document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loaded');
    initReveal();
    setupNavScroll();
    setupParallax();
});
>>>>>>> 4b5564430443db83184e133173b37a1bcc0020d9
