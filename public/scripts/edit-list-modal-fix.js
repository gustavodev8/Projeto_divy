// ===== FIX: MODAL DE EDITAR LISTA =====
// Script para controlar o modal de edição de lista

(function() {
    'use strict';

    console.log('🔧 Iniciando fix do modal de editar lista...');

    // ID da lista sendo editada
    let editingListId = null;

    // ===== GARANTIR QUE O MODAL INICIA FECHADO =====
    function forceCloseModal() {
        const overlay = document.getElementById('editListModalOverlay');
        const modal = document.getElementById('editListModal');

        if (overlay) {
            overlay.classList.remove('active');
        }

        if (modal) {
            modal.classList.remove('active');
        }

        document.body.style.overflow = '';
    }

    // Fecha imediatamente ao carregar
    forceCloseModal();
    setTimeout(forceCloseModal, 100);

    // ===== FUNÇÃO DE ABRIR MODAL =====
    window.openEditListModal = function(listId, listName, listColor, listEmoji) {
        console.log('📝 Abrindo modal de editar lista:', listId);

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

        // Abre o modal adicionando a classe active
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

        console.log('✅ Modal aberto com sucesso');
    };

    // ===== FUNÇÃO DE FECHAR MODAL =====
    window.closeEditListModal = function() {
        console.log('❌ Fechando modal de editar lista');

        const overlay = document.getElementById('editListModalOverlay');
        const modal = document.getElementById('editListModal');

        if (overlay) {
            overlay.classList.remove('active');
        }

        if (modal) {
            modal.classList.remove('active');
        }

        // Restaura scroll do body
        document.body.style.overflow = '';

        // Limpa o ID
        editingListId = null;

        console.log('✅ Modal fechado');
    };

    // ===== FUNÇÃO DE SALVAR =====
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

        console.log('💾 Salvando lista editada:', { id: editingListId, name, color, emoji });

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
                console.log('✅ Lista atualizada com sucesso');

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
            console.error('❌ Erro ao salvar lista:', error);
            alert('❌ Erro ao atualizar lista: ' + error.message);
        }
    };

    // ===== FUNÇÃO DE SELECIONAR EMOJI =====
    window.selectEmoji = function() {
        const emojis = ['📋', '📌', '⭐', '🎯', '💼', '🏠', '🎨', '📚', '💡', '🔥', '✅', '🚀', '💪', '🎮', '🎵', '📱'];
        const btn = document.getElementById('editListEmojiBtn');
        if (!btn) return;

        const current = btn.textContent;
        const currentIndex = emojis.indexOf(current);
        const nextIndex = (currentIndex + 1) % emojis.length;
        btn.textContent = emojis[nextIndex];
    };

    // ===== FECHAR AO CLICAR NO OVERLAY =====
    document.addEventListener('click', (e) => {
        if (e.target.id === 'editListModalOverlay') {
            window.closeEditListModal();
        }
    });

    // ===== FECHAR COM ESC =====
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('editListModalOverlay');
            if (overlay && overlay.classList.contains('active')) {
                window.closeEditListModal();
            }
        }
    });

    console.log('✅ Fix do modal de editar lista carregado!');
})();
