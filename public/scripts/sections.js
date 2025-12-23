// ===== NURA - SISTEMA DE SEÇÕES (TICKTICK STYLE) =====

const SECTIONS_API = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api/sections'
    : `${window.location.origin}/api/sections`;

// Variável global para seções (draggedTask está no sincro_telas.js)
window.userSections = [];

// ===== CARREGAR SEÇÕES =====
async function loadSections() {
    const user = getCurrentUser();
    if (!user) return;

    try {
        const response = await fetch(`${SECTIONS_API}?user_id=${user.id}`);
        const data = await response.json();

        if (data.success) {
            window.userSections = data.sections;
            console.log(`📁 ${window.userSections.length} seções carregadas`);
        }
    } catch (error) {
        console.error('❌ Erro ao carregar seções:', error);
    }
}

// ===== CRIAR SEÇÃO =====
async function createSection(name, emoji = '📁') {
    const user = getCurrentUser();
    if (!user) return null;

    try {
        const response = await fetch(SECTIONS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, name, emoji })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`✅ Seção "${name}" criada!`);
            await loadSections();
            renderAllTasks();
            return data.sectionId;
        }
    } catch (error) {
        console.error('❌ Erro ao criar seção:', error);
        showNotification('❌ Erro ao criar seção');
    }
    return null;
}

// ===== EXCLUIR SEÇÃO =====
async function deleteSection(sectionId) {
    const user = getCurrentUser();
    if (!user) return;

    const section = window.userSections.find(s => s.id === sectionId);
    if (!confirm(`Excluir seção "${section?.name}"? As tarefas serão movidas para "Sem Seção".`)) return;

    try {
        const response = await fetch(`${SECTIONS_API}/${sectionId}?user_id=${user.id}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showNotification('🗑️ Seção excluída');
            await loadSections();
            renderAllTasks();
        }
    } catch (error) {
        console.error('❌ Erro ao excluir seção:', error);
    }
}

// ===== TOGGLE COLAPSAR SEÇÃO =====
async function toggleSectionCollapse(sectionId) {
    const user = getCurrentUser();
    if (!user) return;

    const section = window.userSections.find(s => s.id === sectionId);
    if (!section) return;

    const newState = !section.is_collapsed;

    try {
        await fetch(`${SECTIONS_API}/${sectionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, is_collapsed: newState })
        });

        section.is_collapsed = newState;

        // Toggle visual
        const sectionElement = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (sectionElement) {
            sectionElement.classList.toggle('collapsed', newState);
        }
    } catch (error) {
        console.error('❌ Erro ao toggle seção:', error);
    }
}

// ===== EDITAR SEÇÃO =====
function editSection(sectionId) {
    const section = window.userSections.find(s => s.id === sectionId);
    if (!section) return;

    const modal = document.createElement('div');
    modal.className = 'section-modal-overlay';
    modal.innerHTML = `
        <div class="section-modal">
            <div class="section-modal-header">
                <h3>Editar Seção</h3>
                <button class="section-modal-close" onclick="this.closest('.section-modal-overlay').remove()">×</button>
            </div>
            <div class="section-modal-body">
                <div class="section-modal-field">
                    <label>Emoji</label>
                    <input type="text" id="editSectionEmoji" value="${section.emoji || '📁'}" maxlength="2" style="width: 60px; text-align: center; font-size: 1.5rem;">
                </div>
                <div class="section-modal-field">
                    <label>Nome da Seção</label>
                    <input type="text" id="editSectionName" value="${section.name}" autofocus>
                </div>
            </div>
            <div class="section-modal-actions">
                <button class="btn-cancel" onclick="this.closest('.section-modal-overlay').remove()">Cancelar</button>
                <button class="btn-save" onclick="submitEditSection(${sectionId})">Salvar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('editSectionName').focus();
}

async function submitEditSection(sectionId) {
    const name = document.getElementById('editSectionName').value.trim();
    const emoji = document.getElementById('editSectionEmoji').value.trim() || '📁';
    const user = getCurrentUser();

    if (!name) {
        alert('Digite um nome para a seção');
        return;
    }

    try {
        const response = await fetch(`${SECTIONS_API}/${sectionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, name, emoji })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('✅ Seção atualizada!');
            await loadSections();
            renderAllTasks();
            document.querySelector('.section-modal-overlay')?.remove();
        }
    } catch (error) {
        console.error('❌ Erro ao editar seção:', error);
    }
}

// ===== MODAL CRIAR SEÇÃO =====
function showCreateSectionModal() {
    const modal = document.createElement('div');
    modal.className = 'section-modal-overlay';
    modal.innerHTML = `
        <div class="section-modal">
            <div class="section-modal-header">
                <h3>Nova Seção</h3>
                <button class="section-modal-close" onclick="this.closest('.section-modal-overlay').remove()">×</button>
            </div>
            <div class="section-modal-body">
                <div class="section-modal-field">
                    <label>Emoji</label>
                    <input type="text" id="sectionEmoji" value="📁" maxlength="2" style="width: 60px; text-align: center; font-size: 1.5rem;">
                </div>
                <div class="section-modal-field">
                    <label>Nome da Seção</label>
                    <input type="text" id="sectionName" placeholder="Ex: Trabalho, Pessoal..." autofocus>
                </div>
            </div>
            <div class="section-modal-actions">
                <button class="btn-cancel" onclick="this.closest('.section-modal-overlay').remove()">Cancelar</button>
                <button class="btn-save" onclick="submitCreateSection()">Criar Seção</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Adicionar evento de Enter
    document.getElementById('sectionName').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            submitCreateSection();
        }
    });
    
    document.getElementById('sectionName').focus();
}

async function submitCreateSection() {
    const name = document.getElementById('sectionName').value.trim();
    const emoji = document.getElementById('sectionEmoji').value.trim() || '📁';

    if (!name) {
        alert('Digite um nome para a seção');
        return;
    }

    await createSection(name, emoji);
    document.querySelector('.section-modal-overlay')?.remove();
}

// ===== EXPORTAR FUNÇÕES =====
window.loadSections = loadSections;
window.createSection = createSection;
window.deleteSection = deleteSection;
window.toggleSectionCollapse = toggleSectionCollapse;
window.editSection = editSection;
window.submitEditSection = submitEditSection;
window.showCreateSectionModal = showCreateSectionModal;
window.submitCreateSection = submitCreateSection;

console.log('✅ sections.js carregado');