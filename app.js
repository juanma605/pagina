import { db, auth } from './firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ==========================================================
// 📞 DATOS DE CONTACTO DEL VENDEDOR — REEMPLAZAR ANTES DE PUBLICAR
// Formato del número: código de país + área + número, sin +, sin espacios, sin guiones.
// Ejemplo Argentina (Buenos Aires, celular): "5491122334455"
const WHATSAPP_NUMBER = "5491125507062"; // <-- PONER EL NÚMERO REAL ACÁ
const INSTAGRAM_HANDLE = "shanti_guitars"; // <-- PONER EL USUARIO DE INSTAGRAM ACÁ (sin @)

// ☁️ ALMACENAMIENTO DE IMÁGENES — Cloudinary (plan gratis, sin tarjeta)
// 1) Crear cuenta gratis en https://cloudinary.com
// 2) Copiar el "Cloud name" del Dashboard y pegarlo abajo
// 3) Ir a Settings > Upload > Upload presets > Add upload preset,
//    poner "Signing Mode" en UNSIGNED, y pegar ese nombre de preset abajo
const CLOUDINARY_CLOUD_NAME = "yvf4ohnz"; // <-- PONER EL CLOUD NAME ACÁ
const CLOUDINARY_UPLOAD_PRESET = "claude.preset"; // <-- PONER EL PRESET ACÁ
// ==========================================================

const INVENTORY_COLLECTION = 'atelier_inventory';
let inventory = [];
let activeCategory = 'all';
let searchQuery = '';
let editingId = null;
let currentGallery = [];
let currentGalleryIndex = 0;
let currentImageBlobs = [];
let currentProduct = null;

const UI = {
    navItems: document.querySelectorAll('.nav-item'), views: document.querySelectorAll('.view-section'),
    grid: document.getElementById('product-grid'), modalProd: document.getElementById('modal-product'),
    modImg: document.getElementById('mod-img'), modName: document.getElementById('mod-name'),
    modPrice: document.getElementById('mod-price'), modDesc: document.getElementById('mod-desc'),
    modStatus: document.getElementById('mod-status-tag'), adminTrigger: document.getElementById('admin-trigger'),
    modalLogin: document.getElementById('modal-login'), 
    inpEmail: document.getElementById('inp-email'),
    inpPass: document.getElementById('inp-pass'),
    btnLogin: document.getElementById('btn-login'), btnLogout: document.getElementById('btn-logout'),
    formProduct: document.getElementById('form-product'), closeBtns: document.querySelectorAll('.close-btn'),
    inpFile: document.getElementById('inp-file'), fileLabel: document.getElementById('file-label-display'),
    btnSubmit: document.getElementById('btn-submit'), category: document.getElementById('inp-category'),
    adminList: document.getElementById('admin-product-list'), cancelEdit: document.getElementById('btn-cancel-edit'),
    sort: document.getElementById('sort-products'), filters: document.querySelectorAll('.filter-btn'),
    search: document.getElementById('search-input'),
    galleryPrev: document.getElementById('gallery-prev'), galleryNext: document.getElementById('gallery-next'),
    galleryDots: document.getElementById('gallery-dots'), globalLoader: document.getElementById('global-loader'),
    btnContact: document.getElementById('btn-contact'),
    igLink: document.getElementById('social-instagram'), waLink: document.getElementById('social-whatsapp')
};

if (UI.igLink) UI.igLink.href = `https://instagram.com/${INSTAGRAM_HANDLE}`;
if (UI.waLink) UI.waLink.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hola! Quería consultar por el atelier.')}`;

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
        if (UI.grid) {
            UI.grid.innerHTML = '<p class="empty-state">No pudimos cargar la colección en este momento. Por favor, recargá la página en unos minutos.</p>';
        }
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

function renderPriceHTML(item) {
    const hasDiscount = item.discountPrice && item.discountPrice > 0 && item.discountPrice < item.price;
    if (hasDiscount) {
        return `<span class="discount-badge">Oferta</span><span class="price-original">$${item.price.toLocaleString()}</span><span class="price-discounted">$${item.discountPrice.toLocaleString()}</span>`;
    }
    return `<span class="price-discounted">$${item.price.toLocaleString()}</span>`;
}
 
function renderGrid() {
    if(!UI.grid) return;
    UI.grid.innerHTML = '';
    const sortValue = UI.sort ? UI.sort.value : 'date-desc';
    const products = inventory
        .filter(item => activeCategory === 'all' || item.category === activeCategory)
        .filter(item => {
            if (!searchQuery) return true;
            const haystack = `${item.name} ${item.desc}`.toLowerCase();
            return haystack.includes(searchQuery);
        })
        .sort((first, second) => {
            if (sortValue === 'price-asc') return first.price - second.price;
            if (sortValue === 'price-desc') return second.price - first.price;
            const dateOrder = Number(first.createdAt) - Number(second.createdAt);
            return sortValue === 'date-asc' ? dateOrder : -dateOrder;
        })
        .sort((first, second) => Number(first.status === 'sold') - Number(second.status === 'sold'));
    
    if (!products.length) {
        UI.grid.innerHTML = searchQuery
            ? `<p class="empty-state">No encontramos instrumentos que coincidan con "${UI.search.value.trim()}".</p>`
            : '<p class="empty-state">Todavía no hay piezas cargadas en esta categoría. Volvé pronto.</p>';
        return;
    }

    products.forEach(item => {
        const isSold = item.status === 'sold';
        const card = document.createElement('div');
        card.className = `product-card ${isSold ? 'is-sold' : ''}`;
        card.innerHTML = `
            <div class="card-img-wrapper">
                ${isSold ? '<div class="sold-badge">VENDIDA</div>' : ''}
                <img src="${item.image}" alt="${item.name}" loading="lazy">
            </div>
            <div class="card-meta">
                <div><small>${item.category}</small><h3>${item.name}</h3></div><div class="price-wrap">${renderPriceHTML(item)}</div>
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
        row.innerHTML = `<div><strong>${item.name}</strong><span>${item.category} · ${item.discountPrice && item.discountPrice > 0 && item.discountPrice < item.price ? `$${item.price.toLocaleString()} → $${item.discountPrice.toLocaleString()}` : `$${item.price.toLocaleString()}`} · ${item.status === 'sold' ? 'Vendida' : 'Disponible'}</span></div><div class="admin-row-actions"><button class="btn-text edit-product" type="button">Editar</button><button class="btn-text delete-product" type="button">Borrar</button></div>`;
        row.querySelector('.edit-product').addEventListener('click', () => startEditing(item));
        row.querySelector('.delete-product').addEventListener('click', () => deleteProduct(item.id, item.name));
        UI.adminList.appendChild(row);
    });
}

async function deleteProduct(id, name) {
    if (!auth.currentUser) return alert("Acceso denegado. La sesión expiró.");
    if (!confirm(`¿Borrar "${name}" permanentemente de la bóveda? (La foto seguirá en tu cuenta de Cloudinary; podés borrarla ahí manualmente si querés liberar espacio)`)) return;
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

async function uploadPendingImages() {
    const urls = [];
    for (const blob of currentImageBlobs) {
        const formData = new FormData();
        formData.append('file', blob);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'atelier_inventory');

        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        });
        if (!response.ok) throw new Error('Falló la subida a Cloudinary');
        const data = await response.json();
        urls.push(data.secure_url);
    }
    return urls;
}

if(UI.formProduct) {
    UI.formProduct.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return alert("Acceso denegado.");
        if(!currentImageBlobs.length && !editingId) return alert('La imagen es el alma de la pieza. Requerida.');

        const price = parseFloat(document.getElementById('inp-price').value);
        const discountRaw = document.getElementById('inp-discount-price').value;
        const discountPrice = discountRaw ? parseFloat(discountRaw) : null;

        if (discountPrice !== null && discountPrice >= price) {
            return alert('El precio con descuento tiene que ser menor al precio original.');
        }

        const productData = {
            name: document.getElementById('inp-name').value.trim(),
            price,
            discountPrice: discountPrice !== null ? discountPrice : null,
            desc: document.getElementById('inp-desc').value.trim(), 
            status: document.getElementById('inp-status').value,
            category: UI.category.value
        };

        try {
            UI.btnSubmit.disabled = true;
            UI.globalLoader.classList.remove('hidden');

            if (currentImageBlobs.length) {
                const uploadedUrls = await uploadPendingImages();
                productData.image = uploadedUrls[0];
                productData.images = uploadedUrls;
            }

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
            console.error(error);
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
    document.getElementById('inp-discount-price').value = item.discountPrice || '';
    UI.category.value = item.category;
    document.getElementById('inp-desc').value = item.desc;
    document.getElementById('inp-status').value = item.status;
    
    currentImageBlobs = []; 
    UI.inpFile.required = false;
    UI.fileLabel.textContent = 'Conservar imagen actual (o elegir nuevas fotos para reemplazarla)';
    UI.btnSubmit.textContent = 'Sobrescribir Registro';
    UI.cancelEdit.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetProductForm() {
    UI.formProduct.reset();
    editingId = null;
    currentImageBlobs = [];
    UI.inpFile.required = true;
    UI.fileLabel.textContent = 'Seleccionar Imagen';
    UI.fileLabel.style.color = 'var(--light)';
    UI.fileLabel.style.backgroundColor = 'transparent';
    UI.btnSubmit.textContent = 'Añadir al Inventario';
    UI.cancelEdit.classList.add('hidden');
}

if (UI.cancelEdit) UI.cancelEdit.addEventListener('click', resetProductForm);

function openProduct(item) {
    currentProduct = item;
    currentGallery = Array.isArray(item.images) && item.images.length ? item.images : [item.image];
    currentGalleryIndex = 0;
    renderGallery();
    UI.modName.textContent = item.name;
    UI.modPrice.innerHTML = renderPriceHTML(item); UI.modDesc.textContent = item.desc;
    UI.modStatus.textContent = item.status === 'sold' ? 'Colección Privada' : 'Disponible';
    UI.modStatus.style.color = item.status === 'sold' ? 'var(--bg-dark)' : 'var(--bg-dark)';
    UI.modStatus.style.backgroundColor = item.status === 'sold' ? 'var(--accent)' : 'var(--light)';

    if (UI.btnContact) {
        const isSold = item.status === 'sold';
        const hasDiscount = item.discountPrice && item.discountPrice > 0 && item.discountPrice < item.price;
        const displayPrice = hasDiscount ? item.discountPrice : item.price;
        UI.btnContact.textContent = isSold ? 'Consultar por instrumentos similares' : 'Contactar Luthier';
        const message = isSold
            ? `Hola! Vi la "${item.name}" pero figura vendida. ¿Tenés algo similar?`
            : `Hola! Me interesa la "${item.name}" ($${displayPrice.toLocaleString()}). ¿Sigue disponible?`;
        UI.btnContact.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    }

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
        await signOut(auth);
        switchView('view-home');
    });
}

const MAX_PHOTOS_PER_PRODUCT = 6;

if(UI.inpFile) {
    UI.inpFile.addEventListener('change', function(e) {
        let files = [...e.target.files];
        if (files.length > MAX_PHOTOS_PER_PRODUCT) {
            alert(`Máximo ${MAX_PHOTOS_PER_PRODUCT} fotos por instrumento. Se usarán las primeras ${MAX_PHOTOS_PER_PRODUCT}.`);
            files = files.slice(0, MAX_PHOTOS_PER_PRODUCT);
        }
        if(files.length) {
            UI.fileLabel.textContent = `Procesando ${files.length} foto(s)...`;
            currentImageBlobs = [];
            Promise.all(files.map(compressImageToBlob)).then(blobs => {
                currentImageBlobs = blobs;
                UI.fileLabel.textContent = `${files.length} foto(s) lista(s)`;
                UI.fileLabel.style.color = 'var(--bg-dark)';
                UI.fileLabel.style.backgroundColor = 'var(--accent)';
            }).catch(() => {
                UI.fileLabel.textContent = 'Error. La madera resiste.';
            });
        }
    });
}

// Redimensiona cada foto a un ancho manejable y la devuelve como Blob JPEG,
// listo para subir a Cloudinary (en vez de guardarla como base64 en Firestore).
function compressImageToBlob(file) {
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
                const MAX_WIDTH = 1200;
                const scaleSize = Math.min(1, MAX_WIDTH / img.width);
                canvas.width = img.width * scaleSize;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(blob => {
                    if (blob) resolve(blob); else reject(new Error('No se pudo procesar la imagen'));
                }, 'image/jpeg', 0.82);
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
if (UI.search) UI.search.addEventListener('input', () => {
    searchQuery = UI.search.value.trim().toLowerCase();
    renderGrid();
});

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

function setupNavScroll() {
    const nav = document.querySelector('.sidebar');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('nav-scrolled', window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

function setupParallax() {
    const elements = document.querySelectorAll('[data-parallax]');
    if (!elements.length) return;
    const onScroll = () => {
        elements.forEach((el) => {
            const speed = parseFloat(el.dataset.parallax) || 0.025;
            el.style.transform = `translateY(${window.scrollY * speed}px)`;
        });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}