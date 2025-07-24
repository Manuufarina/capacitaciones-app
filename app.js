// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs, query, where, onSnapshot, writeBatch, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONFIG & INITIALIZATION ---
const firebaseConfig = {
apiKey: "AIzaSyDrvFqzpX-E2RZrOzKBDVoZJiGasQ-FkiI",
authDomain: "capacitaciones-app-7583b.firebaseapp.com",
projectId: "capacitaciones-app-7583b",
storageBucket: "capacitaciones-app-7583b.appspot.com",
messagingSenderId: "540192676165",
appId: "1:540192676165:web:ae93c5b661b5ce6838062c"
};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'san-isidro-capacitaciones';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- GLOBAL STATE ---
let currentUser = null;
let currentUserId = null; 
let isAuthReady = false;
let isAdminLoggedIn = false;
let currentCalendarDate = new Date();
let allCourses = []; // Cache for calendar
let actionToConfirm = null; // For confirmation modal

// --- DOM ELEMENTS ---
const loadingSpinner = document.getElementById('loading-spinner');
const sections = { login: document.getElementById('login-section'), register: document.getElementById('register-section'), main: document.getElementById('main-app-section'), admin: document.getElementById('admin-section') };
const views = { available: document.getElementById('view-available-courses'), calendar: document.getElementById('view-calendar'), myInscriptions: document.getElementById('view-my-inscriptions'), news: document.getElementById('view-news') };
const tabs = { available: document.getElementById('tab-available'), calendar: document.getElementById('tab-calendar'), myInscriptions: document.getElementById('tab-my-inscriptions'), news: document.getElementById('tab-news') };
const userInfoDiv = document.getElementById('user-info');
const welcomeMessage = document.getElementById('welcome-message');
const courseFormModal = document.getElementById('course-form-modal');
const newsFormModal = document.getElementById('news-form-modal');
const courseForm = document.getElementById('course-form');
const newsForm = document.getElementById('news-form');
const enrolledUsersModal = document.getElementById('enrolled-users-modal');
const surveyModal = document.getElementById('survey-modal');
const adminPasswordModal = document.getElementById('admin-password-modal');
const confirmationModal = document.getElementById('confirmation-modal');
const myBadgesList = document.getElementById('my-badges-list');

// --- MOCK DATA (Only for first time setup) ---
async function setupMockData() {
const coursesRef = collection(db, 'artifacts', appId, 'public', 'data', 'courses');
const snapshot = await getDocs(coursesRef);
if (snapshot.empty) {
console.log("No courses found. Setting up mock data...");
const mockCourses = [
{ title: 'Iniciación al Compostaje Doméstico', speaker: 'Lic. Ana Pérez', date: '2025-08-15', location: 'Vivero Municipal', format: 'Presencial', description: 'Aprende los secretos para transformar tus residuos orgánicos.', materials: [], capacity: 20, waitlist: true, badge: 'compostaje' },
{ title: 'Mi Primera Huerta en Balcón', speaker: 'Ing. Agr. Carlos Rodriguez', date: '2025-08-22', location: 'Online via Zoom', format: 'Virtual', description: 'Descubre cómo cultivar tus propias hortalizas.', materials: [], capacity: 0, waitlist: false, badge: 'huerta' },
];
for (const course of mockCourses) { await addDoc(coursesRef, course); }
}
}

// --- UI & VIEW MANAGEMENT ---
function showSection(sectionName) {
Object.values(sections).forEach(s => s.style.display = 'none');
if (sections[sectionName]) sections[sectionName].style.display = 'block';
}

function showView(viewName) {
Object.values(views).forEach(v => v.style.display = 'none');
Object.values(tabs).forEach(t => t.className = 'tab-button px-3 py-3 whitespace-nowrap font-medium text-base md:text-lg text-gray-500 hover:text-gray-700');
if(views[viewName]) {
views[viewName].style.display = 'block';
tabs[viewName].className = 'tab-button px-3 py-3 whitespace-nowrap font-medium text-base md:text-lg border-b-4 brand-border-green brand-green';
}
}

function showModal(message, isEmailSimulation = false) {
if (isEmailSimulation) {
message = `📧 SIMULACIÓN: ${message}. En una aplicación real, se enviaría un email.`;
}
document.getElementById('modal-message-text').textContent = message;
document.getElementById('message-modal').style.display = 'flex';
}

function showConfirmationModal(message, onConfirm) {
document.getElementById('confirmation-message').textContent = message;
actionToConfirm = onConfirm;
confirmationModal.style.display = 'flex';
}

// --- AUTHENTICATION & INITIAL LOAD ---
onAuthStateChanged(auth, async (user) => {
if (user) {
isAuthReady = true;
await setupMockData();
const storedDNI = localStorage.getItem('userDNI');
if(storedDNI) await attemptLogin(storedDNI);
else showSection('login');
listenToAllData(); // Start listening for courses and news
} else {
isAuthReady = false;
currentUserId = null;
showSection('login');
}
loadingSpinner.style.display = 'none';
});

async function initializeAuth() {
try {
loadingSpinner.style.display = 'flex';
if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
await signInWithCustomToken(auth, __initial_auth_token);
} else {
await signInAnonymously(auth);
}
} catch (error) {
console.error("Authentication failed:", error);
showModal("Error de autenticación. Por favor, recargue la página.");
}
}

// --- DATA LISTENERS ---
function listenToAllData() {
const coursesRef = collection(db, 'artifacts', appId, 'public', 'data', 'courses');
onSnapshot(coursesRef, (snapshot) => {
const coursesListDiv = document.getElementById('courses-list');
coursesListDiv.innerHTML = '';
allCourses = [];
snapshot.forEach(doc => {
const course = { id: doc.id, ...doc.data() };
allCourses.push(course);
coursesListDiv.innerHTML += createCourseCard(course);
});
renderCalendar();
document.querySelectorAll('.enroll-button').forEach(button => button.addEventListener('click', handleEnrollment));
});

const newsRef = collection(db, 'artifacts', appId, 'public', 'data', 'news');
onSnapshot(query(newsRef, orderBy("date", "desc")), (snapshot) => {
const newsListDiv = document.getElementById('news-list');
newsListDiv.innerHTML = '';
snapshot.forEach(doc => {
const newsItem = { id: doc.id, ...doc.data() };
const card = `
<div class="bg-white p-6 rounded-lg shadow">
<h4 class="text-2xl font-bold brand-green mb-2">${newsItem.title}</h4>
<p class="text-sm text-gray-500 mb-2">Publicado el ${new Date(newsItem.date).toLocaleDateString('es-AR', {timeZone: 'UTC'})}</p>
<p class="text-gray-700 whitespace-pre-wrap">${newsItem.content}</p>
</div>
`;
newsListDiv.innerHTML += card;
});
});
}

// --- USER FUNCTIONS ---
async function attemptLogin(dni) {
if (!isAuthReady) { showModal("El sistema de autenticación no está listo."); return; }
loadingSpinner.style.display = 'flex';
const dniRegistryRef = doc(db, 'artifacts', appId, 'public', 'data', 'dni_registry', dni);
const dniRegistrySnap = await getDoc(dniRegistryRef);
if (dniRegistrySnap.exists()) {
const registeredUid = dniRegistrySnap.data().uid;
const userProfileRef = doc(db, 'artifacts', appId, 'users', registeredUid);
const userProfileSnap = await getDoc(userProfileRef);
if (userProfileSnap.exists()) {
currentUser = userProfileSnap.data();
currentUserId = registeredUid; 
localStorage.setItem('userDNI', dni);
await showMainApp();
} else {
document.getElementById('register-dni').value = dni;
showSection('register');
}
} else {
document.getElementById('register-dni').value = dni;
showSection('register');
}
loadingSpinner.style.display = 'none';
}

async function showMainApp() {
welcomeMessage.textContent = `Bienvenido/a, ${currentUser.name.split(' ')[0]}`;
userInfoDiv.style.display = 'block';
showSection('main');
showView('available');
await loadMyInscriptions();
}

function createCourseCard(course) {
return `
<div class="card bg-white rounded-xl shadow-md overflow-hidden p-6 border-l-4 brand-border-green flex flex-col">
<h4 class="text-xl font-bold brand-green mb-2">${course.title}</h4>
<p class="text-gray-600 mb-4 flex-grow">${course.description}</p>
<div class="space-y-2 text-sm text-gray-800">
<p><strong>Disertante:</strong> ${course.speaker}</p>
<p><strong>Fecha:</strong> ${new Date(course.date).toLocaleDateString('es-AR', {timeZone: 'UTC'})}</p>
<p><strong>Lugar:</strong> ${course.location}</p>
<p><strong>Formato:</strong> ${course.format}</p>
${course.capacity > 0 ? `<p><strong>Cupo:</strong> <span id="capacity-${course.id}">${course.capacity}</span></p>` : ''}
</div>
<button data-course-id="${course.id}" data-course-title="${course.title}" class="enroll-button w-full mt-4 brand-bg-green text-white font-bold py-2 px-4 rounded-lg hover:bg-green-800 transition-colors">Inscribirme</button>
</div>
`;
}

async function handleEnrollment(event) {
if (!currentUser) { showModal("Debe iniciar sesión para inscribirse."); return; }
const { courseId, courseTitle } = event.target.dataset;
const courseRef = doc(db, 'artifacts', appId, 'public', 'data', 'courses', courseId);
const courseSnap = await getDoc(courseRef);
if (!courseSnap.exists()) { showModal("Esta capacitación ya no existe."); return; }
const course = courseSnap.data();
const enrolledUsersRef = collection(courseRef, 'enrolledUsers');
const waitlistedUsersRef = collection(courseRef, 'waitlistedUsers');
const [enrolledSnap, waitlistedSnap] = await Promise.all([getDocs(enrolledUsersRef), getDocs(waitlistedUsersRef)]);
const isAlreadyEnrolled = enrolledSnap.docs.some(d => d.id === currentUserId);
const isAlreadyWaitlisted = waitlistedSnap.docs.some(d => d.id === currentUserId);
if (isAlreadyEnrolled || isAlreadyWaitlisted) { showModal(`Ya se encuentra inscripto/a o en lista de espera para "${courseTitle}".`); return; }
loadingSpinner.style.display = 'flex';
try {
if (course.capacity > 0 && enrolledSnap.size >= course.capacity) {
if (course.waitlist) {
await setDoc(doc(waitlistedUsersRef, currentUserId), { name: currentUser.name, dni: currentUser.dni, email: currentUser.email, timestamp: new Date() });
showModal(`El cupo está lleno. Has sido añadido a la lista de espera para "${courseTitle}".`, true);
} else { showModal(`Lo sentimos, el cupo para "${courseTitle}" está completo.`); }
} else {
const batch = writeBatch(db);
batch.set(doc(enrolledUsersRef, currentUserId), { name: currentUser.name, dni: currentUser.dni, email: currentUser.email, status: 'inscripto' });
batch.set(doc(db, 'artifacts', appId, 'users', currentUserId, 'enrollments', courseId), { status: 'inscripto', completionDate: null, surveyCompleted: false });
await batch.commit();
showModal(`¡Inscripción exitosa a "${courseTitle}"!`, true);
}
loadMyInscriptions();
} catch (error) {
console.error("Error al inscribirse:", error);
showModal("Hubo un error al procesar su inscripción.");
} finally { loadingSpinner.style.display = 'none'; }
}

async function loadMyInscriptions() {
const inscriptionsListDiv = document.getElementById('my-inscriptions-list');
if (!currentUserId) return;
const enrollmentsRef = collection(db, 'artifacts', appId, 'users', currentUserId, 'enrollments');
onSnapshot(enrollmentsRef, async (snapshot) => {
if (snapshot.empty) { inscriptionsListDiv.innerHTML = '<p>Aún no se ha inscripto a ninguna capacitación.</p>'; renderBadges([]); return; }
inscriptionsListDiv.innerHTML = '';
let completedCoursesCount = 0;
for (const enrollmentDoc of snapshot.docs) {
const enrollment = { id: enrollmentDoc.id, ...enrollmentDoc.data() };
const courseDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'courses', enrollment.id);
const courseSnap = await getDoc(courseDocRef);
if (courseSnap.exists()) {
const course = courseSnap.data();
let materialsHTML = '';
if(course.materials && course.materials.length > 0) {
const links = course.materials.map(link => `<a href="${link}" target="_blank" class="text-blue-600 hover:underline block">${link}</a>`).join('');
materialsHTML = `<div class="mt-4 p-4 brand-bg-light-green rounded-lg"><h5 class="font-bold mb-2">Material de Cursada</h5>${links}</div>`;
}
let actionsHTML = '';
if (enrollment.status === 'finalizado') {
completedCoursesCount++;
actionsHTML += `<button data-course-name="${course.title}" data-completion-date="${enrollment.completionDate}" class="download-cert-button bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm">Descargar Certificado</button>`;
if (!enrollment.surveyCompleted) {
actionsHTML += `<button data-course-id="${enrollment.id}" class="open-survey-button bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors text-sm ml-2">Realizar Encuesta</button>`;
}
}
inscriptionsListDiv.innerHTML += `<div class="bg-white rounded-xl shadow-md overflow-hidden p-6"><div class="md:flex justify-between items-start"><div><h4 class="text-xl font-bold brand-green">${course.title}</h4><p class="text-gray-600"><strong>Fecha:</strong> ${new Date(course.date).toLocaleDateString('es-AR', {timeZone: 'UTC'})}</p><p class="capitalize font-semibold mt-2"><strong>Estado:</strong> <span class="${enrollment.status === 'finalizado' ? 'text-green-600' : 'text-yellow-600'}">${enrollment.status}</span></p></div><div class="mt-4 md:mt-0 md:text-right">${actionsHTML}</div></div>${materialsHTML}</div>`;
}
}
const userProfileSnap = await getDoc(doc(db, 'artifacts', appId, 'users', currentUserId));
renderBadges(userProfileSnap.data().badges || []);
document.querySelectorAll('.download-cert-button').forEach(b => b.addEventListener('click', generateCertificate));
document.querySelectorAll('.open-survey-button').forEach(b => b.addEventListener('click', (e) => openSurvey(e.target.dataset.courseId)));
});
}

async function generateCertificate(event) {
loadingSpinner.style.display = 'flex';
const { courseName, completionDate } = event.target.dataset;
document.getElementById('cert-user-name').textContent = currentUser.name;
document.getElementById('cert-course-name').textContent = courseName;
document.getElementById('cert-completion-date').textContent = new Date(completionDate).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
try {
const canvas = await html2canvas(document.getElementById('certificate-template'), { scale: 2 });
const { jsPDF } = window.jspdf;
const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
pdf.save(`Certificado-${currentUser.name.replace(/\s/g, '_')}.pdf`);
} catch (error) { console.error("Error generating PDF:", error); showModal("No se pudo generar el certificado."); }
finally { loadingSpinner.style.display = 'none'; }
}

// --- CALENDAR FUNCTIONS ---
const calendarBody = document.getElementById('calendar-body');
const monthYearEl = document.getElementById('calendar-month-year');
function renderCalendar() {
calendarBody.innerHTML = '';
const date = currentCalendarDate;
const year = date.getFullYear();
const month = date.getMonth();
monthYearEl.textContent = `${date.toLocaleString('es-AR', { month: 'long' }).toUpperCase()} ${year}`;
const firstDayOfMonth = new Date(year, month, 1);
const daysInMonth = new Date(year, month + 1, 0).getDate();
const startDayOfWeek = firstDayOfMonth.getDay();
for (let i = 0; i < startDayOfWeek; i++) { calendarBody.innerHTML += `<div class="calendar-day other-month"></div>`; }
for (let day = 1; day <= daysInMonth; day++) {
const dayEl = document.createElement('div');
dayEl.className = 'calendar-day';
dayEl.innerHTML = `<span>${day}</span>`;
const currentDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const coursesOnThisDay = allCourses.filter(c => c.date === currentDateStr);
if (coursesOnThisDay.length > 0) {
dayEl.innerHTML += `<div class="calendar-event-dot"></div>`;
dayEl.style.cursor = 'pointer';
dayEl.onclick = () => {
const courseTitles = coursesOnThisDay.map(c => `- ${c.title}`).join('\n');
showModal(`Capacitaciones para el ${day}/${month+1}:\n${courseTitles}`);
};
}
calendarBody.appendChild(dayEl);
}
}

// --- GAMIFICATION FUNCTIONS ---
const badgeSVGs = {
compostaje: `<svg title="Insignia de Compostaje" class="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="#065f46" stroke-width="1.5"><path d="M14 13c-1.99-2.005-2.32-4.943-1-7 2.22-3.403 6.54-3.633 8-1 .5 1-1.12 3.89-3.32 5.49-1.5 1.12-3.99 1.5-4.68 2.51zM9.08 14.15l-2.2-2.2-4.95 4.95 2.2 2.2 4.95-4.95z"></path><path d="M10.5 12.5l-1.5-1.5"></path><path d="M4.5 19.5l-1.5-1.5"></path><path d="M15.5 7.5l-1.5-1.5"></path><path d="M12.5 20.5a1 1 0 100-2 1 1 0 000 2zM6.5 14.5a1 1 0 100-2 1 1 0 000 2zM9.5 9.5a1 1 0 100-2 1 1 0 000 2z"></path></svg>`,
huerta: `<svg title="Insignia de Huerta" class="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="#065f46" stroke-width="1.5"><path d="M3 21h18M5 21V7l7-4 7 4v14"></path><path d="M9 21v-8a3 3 0 016 0v8"></path></svg>`,
default: `<svg title="Insignia de Participación" class="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="#065f46" stroke-width="1.5"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 17 17 23 15.79 13.88"></polyline></svg>`
};
function renderBadges(userBadges = []) {
myBadgesList.innerHTML = '';
if (userBadges.length === 0) { myBadgesList.innerHTML = '<p class="text-gray-500">Completa capacitaciones para ganar insignias.</p>'; return; }
userBadges.forEach(badgeName => { myBadgesList.innerHTML += badgeSVGs[badgeName] || badgeSVGs.default; });
}

// --- SURVEY FUNCTIONS ---
function openSurvey(courseId) {
document.getElementById('survey-course-id').value = courseId;
surveyModal.style.display = 'flex';
document.getElementById('survey-form').reset();
setupRating('rating-content');
setupRating('rating-speaker');
}
async function handleSurveySubmit(e) {
e.preventDefault();
const courseId = document.getElementById('survey-course-id').value;
const contentRating = document.querySelectorAll('#rating-content .text-yellow-400').length;
const speakerRating = document.querySelectorAll('#rating-speaker .text-yellow-400').length;
const comments = document.getElementById('survey-comments').value;
if (contentRating === 0 || speakerRating === 0) { showModal("Por favor, seleccione una calificación para ambas categorías."); return; }
const surveyData = { contentRating, speakerRating, comments, userId: currentUserId, timestamp: new Date() };
try {
await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'courses', courseId, 'surveys'), surveyData);
await updateDoc(doc(db, 'artifacts', appId, 'users', currentUserId, 'enrollments', courseId), { surveyCompleted: true });
showModal("¡Gracias por su feedback!");
surveyModal.style.display = 'none';
} catch (error) { console.error("Error submitting survey:", error); showModal("No se pudo enviar la encuesta."); }
}
function setupRating(containerId) {
const container = document.getElementById(containerId);
const stars = container.querySelectorAll('span');
stars.forEach((star, index) => {
star.textContent = '☆';
star.className = 'text-gray-400';
star.onclick = () => { stars.forEach((s, i) => { s.textContent = i <= index ? '★' : '☆'; s.className = i <= index ? 'text-yellow-400' : 'text-gray-400'; }); };
});
}

// --- ADMIN FUNCTIONS ---
function showAdminPanel() { isAdminLoggedIn = true; showSection('admin'); loadAdminCourses(); loadAdminNews(); }
function loadAdminCourses() {
const adminCoursesListDiv = document.getElementById('admin-courses-list');
onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'courses'), (snapshot) => {
adminCoursesListDiv.innerHTML = '';
snapshot.forEach(doc => {
const course = { id: doc.id, ...doc.data() };
adminCoursesListDiv.innerHTML += `<div class="bg-white p-4 rounded-lg shadow-md flex justify-between items-center"><div><p class="font-bold text-lg">${course.title}</p><p class="text-sm text-gray-500">${new Date(course.date).toLocaleDateString('es-AR', {timeZone: 'UTC'})}</p></div><div class="flex space-x-2"><button data-course-id="${course.id}" class="view-enrolled-button bg-blue-500 text-white p-2 rounded-lg text-sm">Inscriptos</button><button data-course-id="${course.id}" class="edit-course-button bg-yellow-500 text-white p-2 rounded-lg text-sm">Editar</button><button data-course-id="${course.id}" data-course-title="${course.title}" class="delete-course-button bg-red-500 text-white p-2 rounded-lg text-sm">Eliminar</button></div></div>`;
});
document.querySelectorAll('.view-enrolled-button').forEach(b => b.onclick = (e) => showEnrolledUsers(e.target.dataset.courseId));
document.querySelectorAll('.edit-course-button').forEach(b => b.onclick = (e) => openCourseForm(e.target.dataset.courseId));
document.querySelectorAll('.delete-course-button').forEach(b => b.onclick = (e) => deleteCourse(e.target.dataset.courseId, e.target.dataset.courseTitle));
});
}
function openCourseForm(courseId = null) {
courseForm.reset();
document.getElementById('course-form-title').textContent = courseId ? "Editar Capacitación" : "Crear Capacitación";
if (courseId) {
getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'courses', courseId)).then(docSnap => {
if (docSnap.exists()) {
const course = docSnap.data();
document.getElementById('course-id').value = courseId;
document.getElementById('course-title').value = course.title;
document.getElementById('course-description').value = course.description;
document.getElementById('course-speaker').value = course.speaker;
document.getElementById('course-date').value = course.date;
document.getElementById('course-location').value = course.location;
document.getElementById('course-format').value = course.format;
document.getElementById('course-capacity').value = course.capacity;
document.getElementById('course-waitlist').checked = course.waitlist;
document.getElementById('course-materials').value = (course.materials || []).join('\n');
}
});
} else {
document.getElementById('course-id').value = '';
}
courseFormModal.style.display = 'flex';
}
async function saveCourse(e) {
e.preventDefault();
loadingSpinner.style.display = 'flex';
const courseId = document.getElementById('course-id').value;
const courseData = {
title: document.getElementById('course-title').value,
description: document.getElementById('course-description').value,
speaker: document.getElementById('course-speaker').value,
date: document.getElementById('course-date').value,
location: document.getElementById('course-location').value,
format: document.getElementById('course-format').value,
capacity: parseInt(document.getElementById('course-capacity').value) || 0,
waitlist: document.getElementById('course-waitlist').checked,
materials: document.getElementById('course-materials').value.split('\n').filter(link => link.trim() !== ''),
};
try {
if (courseId) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'courses', courseId), courseData); } 
else { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'courses'), courseData); }
showModal("Capacitación guardada.");
courseFormModal.style.display = 'none';
} catch (error) { console.error("Error saving course:", error); showModal("Error al guardar."); }
finally { loadingSpinner.style.display = 'none'; }
}

function deleteCourse(courseId, courseTitle) {
showConfirmationModal(`¿Está seguro que desea eliminar la capacitación "${courseTitle}"? Esta acción no se puede deshacer.`, async () => {
loadingSpinner.style.display = 'flex';
try {
await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'courses', courseId));
showModal("Capacitación eliminada.");
} catch (error) { console.error("Error deleting course:", error); showModal("Error al eliminar la capacitación."); }
finally { loadingSpinner.style.display = 'none'; }
});
}

async function showEnrolledUsers(courseId) {
const courseSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'courses', courseId));
if (!courseSnap.exists()) return;
document.getElementById('enrolled-users-title').textContent = `Inscriptos en "${courseSnap.data().title}"`;
document.getElementById('export-csv-button').onclick = () => exportToCSV(courseId, courseSnap.data().title);
const contentDiv = document.getElementById('enrolled-users-content');
const enrolledRef = collection(db, 'artifacts', appId, 'public', 'data', 'courses', courseId, 'enrolledUsers');
onSnapshot(enrolledRef, (snapshot) => {
contentDiv.innerHTML = '<h4 class="font-bold text-lg mt-4 mb-2">Inscriptos</h4><div class="grid grid-cols-4 font-bold p-2"><p>Nombre</p><p>DNI</p><p>Email</p><p>Acciones</p></div>';
if (snapshot.empty) contentDiv.innerHTML += '<p class="p-2">Nadie se ha inscripto aún.</p>';
snapshot.forEach(userDoc => {
const user = { id: userDoc.id, ...userDoc.data() };
contentDiv.innerHTML += `<div class="grid grid-cols-4 items-center p-2 border-t"><p>${user.name}</p><p>${user.dni}</p><p>${user.email}</p><div>${user.status !== 'finalizado' ? `<button data-user-id="${user.id}" data-user-name="${user.name}" data-course-id="${courseId}" class="mark-complete-button bg-green-500 text-white text-xs p-2 rounded">Marcar Finalizado</button>` : '<span class="text-green-600 font-bold text-xs">Finalizado</span>'}</div></div>`;
});
document.querySelectorAll('.mark-complete-button').forEach(b => b.onclick = (e) => markAsCompleted(e.target.dataset.userId, e.target.dataset.courseId, e.target.dataset.userName));
});
enrolledUsersModal.style.display = 'flex';
}
async function markAsCompleted(userId, courseId, userName) {
showConfirmationModal(`¿Marcar a ${userName} como finalizado? Se le otorgará una insignia y podrá descargar su certificado.`, async () => {
loadingSpinner.style.display = 'flex';
const completionDate = new Date().toISOString().split('T')[0];
try {
const batch = writeBatch(db);
batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'courses', courseId, 'enrolledUsers', userId), { status: 'finalizado' });
batch.update(doc(db, 'artifacts', appId, 'users', userId, 'enrollments', courseId), { status: 'finalizado', completionDate: completionDate });
const courseSnap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'courses', courseId));
const badge = courseSnap.data().badge || 'default';
const userProfileRef = doc(db, 'artifacts', appId, 'users', userId);
const userProfileSnap = await getDoc(userProfileRef);
const currentBadges = userProfileSnap.data().badges || [];
if (!currentBadges.includes(badge)) { batch.update(userProfileRef, { badges: [...currentBadges, badge] }); }
await batch.commit();
showModal(`Usuario ${userName} marcado como finalizado.`, true);
} catch (error) { console.error("Error marking as complete:", error); }
finally { loadingSpinner.style.display = 'none'; }
});
}
async function exportToCSV(courseId, courseTitle) {
const enrolledUsersRef = collection(db, 'artifacts', appId, 'public', 'data', 'courses', courseId, 'enrolledUsers');
const waitlistedUsersRef = collection(db, 'artifacts', appId, 'public', 'data', 'courses', courseId, 'waitlistedUsers');
const [enrolledSnap, waitlistedSnap] = await Promise.all([getDocs(enrolledUsersRef), getDocs(waitlistedUsersRef)]);
let csvContent = "data:text/csv;charset=utf-8,";
csvContent += "Nombre,DNI,Email,Estado\r\n";
enrolledSnap.forEach(doc => { const user = doc.data(); csvContent += `"${user.name}","${user.dni}","${user.email}","Inscripto"\r\n`; });
waitlistedSnap.forEach(doc => { const user = doc.data(); csvContent += `"${user.name}","${user.dni}","${user.email}","En Lista de Espera"\r\n`; });
const encodedUri = encodeURI(csvContent);
const link = document.createElement("a");
link.setAttribute("href", encodedUri);
link.setAttribute("download", `inscriptos_${courseTitle.replace(/\s/g, '_')}.csv`);
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
}
function loadAdminNews() {
const adminNewsListDiv = document.getElementById('admin-news-list');
onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'news'), orderBy("date", "desc")), (snapshot) => {
adminNewsListDiv.innerHTML = '';
snapshot.forEach(doc => {
const news = { id: doc.id, ...doc.data() };
adminNewsListDiv.innerHTML += `<div class="bg-white p-4 rounded-lg shadow-md flex justify-between items-center"><div><p class="font-bold text-lg">${news.title}</p></div><div class="flex space-x-2"><button data-news-id="${news.id}" class="edit-news-button bg-yellow-500 text-white p-2 rounded-lg text-sm">Editar</button><button data-news-id="${news.id}" data-news-title="${news.title}" class="delete-news-button bg-red-500 text-white p-2 rounded-lg text-sm">Eliminar</button></div></div>`;
});
document.querySelectorAll('.edit-news-button').forEach(b => b.onclick = (e) => openNewsForm(e.target.dataset.newsId));
document.querySelectorAll('.delete-news-button').forEach(b => b.onclick = (e) => deleteNews(e.target.dataset.newsId, e.target.dataset.newsTitle));
});
}
function openNewsForm(newsId = null) {
newsForm.reset();
document.getElementById('news-form-title').textContent = newsId ? "Editar Noticia" : "Crear Noticia";
if (newsId) {
getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'news', newsId)).then(docSnap => {
if (docSnap.exists()) {
const news = docSnap.data();
document.getElementById('news-id').value = newsId;
document.getElementById('news-title').value = news.title;
document.getElementById('news-content').value = news.content;
}
});
} else {
document.getElementById('news-id').value = '';
}
newsFormModal.style.display = 'flex';
}
async function saveNews(e) {
e.preventDefault();
loadingSpinner.style.display = 'flex';
const newsId = document.getElementById('news-id').value;
const newsData = {
title: document.getElementById('news-title').value,
content: document.getElementById('news-content').value,
date: new Date().toISOString().split('T')[0]
};
try {
if (newsId) { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'news', newsId), newsData); } 
else { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'news'), newsData); }
showModal("Noticia guardada.");
newsFormModal.style.display = 'none';
} catch (error) { console.error("Error saving news:", error); showModal("Error al guardar la noticia."); }
finally { loadingSpinner.style.display = 'none'; }
}
function deleteNews(newsId, newsTitle) {
showConfirmationModal(`¿Está seguro que desea eliminar la noticia "${newsTitle}"?`, async () => {
loadingSpinner.style.display = 'flex';
try {
await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'news', newsId));
showModal("Noticia eliminada.");
} catch (error) { console.error("Error deleting news:", error); showModal("Error al eliminar la noticia."); }
finally { loadingSpinner.style.display = 'none'; }
});
}

// --- EVENT LISTENERS ---
document.getElementById('login-form').addEventListener('submit', (e) => { e.preventDefault(); attemptLogin(document.getElementById('dni-input').value); });
document.getElementById('register-form').addEventListener('submit', async (e) => {
e.preventDefault();
loadingSpinner.style.display = 'flex';
const userData = {
dni: document.getElementById('register-dni').value,
name: document.getElementById('register-name').value,
address: document.getElementById('register-address').value,
phone: document.getElementById('register-phone').value,
email: document.getElementById('register-email').value,
hasHuerta: document.querySelector('input[name="huerta-compostera"]:checked').value === 'si',
huertaAddress: document.getElementById('register-huerta-address').value,
badges: []
};
try {
const newUserId = auth.currentUser.uid;
await setDoc(doc(db, 'artifacts', appId, 'users', newUserId), userData);
await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'dni_registry', userData.dni), { uid: newUserId });
currentUser = userData;
currentUserId = newUserId;
localStorage.setItem('userDNI', userData.dni);
await showMainApp();
} catch (error) { console.error("Error during registration:", error); }
finally { loadingSpinner.style.display = 'none'; }
});
document.querySelectorAll('input[name="huerta-compostera"]').forEach(radio => radio.addEventListener('change', (e) => { document.getElementById('huerta-address-container').style.display = e.target.value === 'si' ? 'block' : 'none'; }));
Object.keys(tabs).forEach(key => tabs[key].addEventListener('click', () => showView(key)));
document.getElementById('logout-button').addEventListener('click', () => { localStorage.removeItem('userDNI'); currentUser = null; currentUserId = null; userInfoDiv.style.display = 'none'; document.getElementById('dni-input').value = ''; showSection('login'); });
document.getElementById('modal-close-button').addEventListener('click', () => { document.getElementById('message-modal').style.display = 'none'; });
document.getElementById('prev-month-btn').addEventListener('click', () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); renderCalendar(); });
document.getElementById('next-month-btn').addEventListener('click', () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); renderCalendar(); });
document.getElementById('survey-form').addEventListener('submit', handleSurveySubmit);
document.getElementById('cancel-survey-form').addEventListener('click', () => surveyModal.style.display = 'none');
document.getElementById('admin-login-button').addEventListener('click', () => { adminPasswordModal.style.display = 'flex'; document.getElementById('admin-password-input').focus(); });
document.getElementById('admin-password-form').addEventListener('submit', (e) => { e.preventDefault(); const pass = document.getElementById('admin-password-input').value; if (pass === "admin123") { adminPasswordModal.style.display = 'none'; document.getElementById('admin-password-input').value = ''; showAdminPanel(); } else { showModal("Contraseña incorrecta."); } });
document.getElementById('cancel-admin-password-form').addEventListener('click', () => { adminPasswordModal.style.display = 'none'; document.getElementById('admin-password-input').value = ''; });
document.getElementById('admin-logout-button').addEventListener('click', () => { isAdminLoggedIn = false; if (currentUser) { showSection('main'); } else { showSection('login'); } });
document.querySelectorAll('.admin-tab-button').forEach(button => button.addEventListener('click', (e) => {
document.querySelectorAll('.admin-tab-button').forEach(b => b.className = 'admin-tab-button px-4 py-2 font-medium text-gray-500');
e.target.className = 'admin-tab-button px-4 py-2 font-medium border-b-4 brand-border-green brand-green';
document.getElementById('admin-courses-view').style.display = e.target.dataset.view === 'admin-courses' ? 'block' : 'none';
document.getElementById('admin-news-view').style.display = e.target.dataset.view === 'admin-news' ? 'block' : 'none';
}));
document.getElementById('add-course-button').addEventListener('click', () => openCourseForm());
document.getElementById('cancel-course-form').addEventListener('click', () => courseFormModal.style.display = 'none');
courseForm.addEventListener('submit', saveCourse);
document.getElementById('add-news-button').addEventListener('click', () => openNewsForm());
document.getElementById('cancel-news-form').addEventListener('click', () => newsFormModal.style.display = 'none');
newsForm.addEventListener('submit', saveNews);
document.getElementById('close-enrolled-users-modal').addEventListener('click', () => enrolledUsersModal.style.display = 'none');
document.getElementById('cancel-confirmation-button').addEventListener('click', () => { confirmationModal.style.display = 'none'; actionToConfirm = null; });
document.getElementById('confirm-action-button').addEventListener('click', () => { if (typeof actionToConfirm === 'function') { actionToConfirm(); } confirmationModal.style.display = 'none'; actionToConfirm = null; });

// --- INITIAL LOAD ---
initializeAuth();
