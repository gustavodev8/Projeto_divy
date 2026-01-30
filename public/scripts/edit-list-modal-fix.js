// ===== FIX NUCLEAR: MODAL DE EDITAR LISTA =====
// Adicione este script NO FINAL do body, depois de todos os outros scripts

(function() {
    'use strict';
    
    console.log('🔧 Iniciando fix do modal de editar lista...');
    
    // ===== 1. GARANTIR QUE O MODAL INICIA FECHADO =====
    function forceCloseModal() {
        const overlay = document.getElementById('editListModalOverlay');
        const modal = document.getElementById('editListModal');
        
        if (overlay) {
            overlay.style.cssText = `
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
            `;
            overlay.classList.remove('active');
        }
        
        if (modal) {
            modal.style.cssText = `
                opacity: 0 !important;
                transform: scale(0.95) translateY(10px) !important;
            `;
            modal.classList.remove('active');
        }
    }
    
    // Fecha imediatamente
    forceCloseModal();
    
    // Fecha novamente após um pequeno delay (para sobrescrever qualquer coisa que abra)
    setTimeout(forceCloseModal, 100);
    setTimeout(forceCloseModal, 500);
    setTimeout(forceCloseModal, 1000);
    
    // ===== 2. SOBRESCREVER A FUNÇÃO DE ABRIR MODAL =====
    let editingListId = null;
    
    window.openEditListModal = function(listId, listName, listColor, listEmoji) {
        console.log('📝 [FIX] Abrindo modal de editar lista:', listId);
        
        editingListId = listId;
        
        // Remove foco de qualquer elemento
        if (document.activeElement) {
            document.activeElement.blur();
        }
        
        // Preenche os campos
        const nameInput = document.getElementById('editListName');
        const colorInput = document.getElementById('editListColor');
        const emojiBtn = document.getElementById('editListEmojiBtn');
        
        if (nameInput) nameInput.value = listName || '';
        if (colorInput) colorInput.value = listColor || '#146551';
        if (emojiBtn) emojiBtn.textContent = listEmoji || '📋';
        
        // Pega os elementos do modal
        const overlay = document.getElementById('editListModalOverlay');
        const modal = document.getElementById('editListModal');
        
        if (!overlay || !modal) {
            console.error('❌ Elementos do modal não encontrados!');
            alert('Erro: Modal não encontrado');
            return;
        }
        
        // FORÇA o estilo de abertura
        overlay.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: rgba(0, 0, 0, 0.6) !important;
            backdrop-filter: blur(4px) !important;
            -webkit-backdrop-filter: blur(4px) !important;
            z-index: 99999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            opacity: 1 !important;
            visibility: visible !important;
        `;
        
        modal.style.cssText = `
            position: relative !important;
            background: var(--surface-main, #1a1a1a) !important;
            border-radius: 16px !important;
            width: 90% !important;
            max-width: 420px !important;
            max-height: 90vh !important;
            overflow: hidden !important;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4) !important;
            border: 1px solid var(--border-light, #2a2a2a) !important;
            opacity: 1 !important;
            transform: scale(1) translateY(0) !important;
            z-index: 100000 !important;
        `;
        
        overlay.classList.add('active');
        modal.classList.add('active');
        
        // Previne scroll do body
        document.body.style.overflow = 'hidden';
        
        // Foca no input após um delay
        setTimeout(() => {
            if (nameInput) {
                nameInput.focus();
                nameInput.select();
            }
        }, 200);
        
        console.log('✅ [FIX] Modal aberto com sucesso');
    };
    
    // ===== 3. SOBRESCREVER A FUNÇÃO DE FECHAR MODAL =====
    window.closeEditListModal = function() {
        console.log('❌ [FIX] Fechando modal de editar lista');
        
        const overlay = document.getElementById('editListModalOverlay');
        const modal = document.getElementById('editListModal');
        
        if (overlay) {
            overlay.style.cssText = `
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
            `;
            overlay.classList.remove('active');
        }
        
        if (modal) {
            modal.style.cssText = `
                opacity: 0 !important;
                transform: scale(0.95) translateY(10px) !important;
            `;
            modal.classList.remove('active');
        }
        
        // Restaura scroll do body
        document.body.style.overflow = '';
        
        // Limpa o ID
        editingListId = null;
        
        console.log('✅ [FIX] Modal fechado');
    };
    
    // ===== 4. SOBRESCREVER A FUNÇÃO DE SALVAR =====
    window.saveEditedList = async function() {
        if (!editingListId) {
            console.error('❌ Nenhuma lista selecionada');
            return;
        }
        
        const name = document.getElementById('editListName')?.value.trim();
        const color = document.getElementById('editListColor')?.value;
        const emoji = document.getElementById('editListEmojiBtn')?.textContent;
        
        if (!name) {
            alert('Por favor, insira um nome para a lista');
            document.getElementById('editListName')?.focus();
            return;
        }
        
        console.log('💾 [FIX] Salvando lista editada:', { id: editingListId, name, color, emoji });
        
        try {
            const userId = typeof getUserId === 'function' ? getUserId() : null;
            
            if (!userId) {
                alert('Erro: Usuário não identificado');
                return;
            }
            
            const response = await fetch(`/api/lists/${editingListId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': userId.toString()
                },
                body: JSON.stringify({
                    name,
                    color,
                    emoji,
                    user_id: userId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log('✅ [FIX] Lista atualizada com sucesso');
                
                // Fecha o modal
                window.closeEditListModal();
                
                // Recarrega as listas
                if (typeof loadLists === 'function') {
                    await loadLists();
                }
                
                // Mostra notificação se disponível
                if (typeof showNotification === 'function') {
                    showNotification('✅ Lista atualizada!');
                }
            } else {
                throw new Error(data.error || 'Erro ao atualizar lista');
            }
        } catch (error) {
            console.error('❌ [FIX] Erro ao salvar lista:', error);
            alert('❌ Erro ao atualizar lista: ' + error.message);
        }
    };
    
    // ===== 5. FUNÇÃO DE SELECIONAR EMOJI =====
    window.selectEmoji = function() {
        const emojis = ['📋', '📌', '⭐', '🎯', '💼', '🏠', '🎨', '📚', '💡', '🔥', '✅', '🚀', '💪', '🎮', '🎵', '📱'];
        const btn = document.getElementById('editListEmojiBtn');
        if (!btn) return;
        
        const current = btn.textContent;
        const currentIndex = emojis.indexOf(current);
        const nextIndex = (currentIndex + 1) % emojis.length;
        btn.textContent = emojis[nextIndex];
    };
    
    // ===== 6. FECHAR AO CLICAR NO OVERLAY =====
    document.addEventListener('click', (e) => {
        if (e.target.id === 'editListModalOverlay') {
            window.closeEditListModal();
        }
    });
    
    // ===== 7. FECHAR COM ESC =====
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('editListModalOverlay');
            if (overlay && overlay.classList.contains('active')) {
                window.closeEditListModal();
            }
        }
    });
    
    // ===== 8. PREVENIR ABERTURA AUTOMÁTICA NOS PRIMEIROS 2 SEGUNDOS =====
    let protectionActive = true;
    const originalOpen = window.openEditListModal;
    
    window.openEditListModal = function(...args) {
        if (protectionActive) {
            console.warn('🛡️ [FIX] Proteção ativa - ignorando abertura automática');
            return;
        }
        return originalOpen.apply(this, args);
    };
    
    setTimeout(() => {
        protectionActive = false;
        console.log('✅ [FIX] Proteção desativada - modal liberado para uso');
    }, 2000);
    
    console.log('✅ Fix do modal de editar lista carregado!');
})();