/* ========================================
   VALIDADORES DE INPUT
   ======================================== */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware para processar erros de validação
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Dados inválidos',
            code: 'VALIDATION_ERROR',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }

    next();
};

// ===== VALIDADORES DE AUTENTICAÇÃO =====

const validateLogin = [
    body('email')
        .optional()
        .isEmail()
        .withMessage('Email inválido'),
    body('username')
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage('Username deve ter entre 3 e 50 caracteres')
        .trim()
        .escape(),
    body('password')
        .notEmpty()
        .withMessage('Senha é obrigatória')
        .isLength({ min: 1 })
        .withMessage('Senha deve ter pelo menos 1 caractere'),
    handleValidationErrors
];

const validateRegister = [
    body('name')
        .notEmpty()
        .withMessage('Nome é obrigatório')
        .isLength({ min: 2, max: 100 })
        .withMessage('Nome deve ter entre 2 e 100 caracteres')
        .trim()
        .escape(),
    body('email')
        .notEmpty()
        .withMessage('Email é obrigatório')
        .isEmail()
        .withMessage('Email inválido'),
    body('password')
        .notEmpty()
        .withMessage('Senha é obrigatória')
        .isLength({ min: 6 })
        .withMessage('Senha deve ter pelo menos 6 caracteres'),
    body('username')
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage('Username deve ter entre 3 e 50 caracteres')
        .trim()
        .escape(),
    handleValidationErrors
];

// ===== VALIDADORES DE TAREFAS =====

const validateCreateTask = [
    body('title')
        .notEmpty()
        .withMessage('Título é obrigatório')
        .isLength({ min: 1, max: 255 })
        .withMessage('Título deve ter entre 1 e 255 caracteres')
        .trim(),
    body('description')
        .optional()
        .isLength({ max: 5000 })
        .withMessage('Descrição deve ter no máximo 5000 caracteres')
        .trim(),
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high'])
        .withMessage('Prioridade deve ser low, medium ou high'),
    body('status')
        .optional()
        .isIn(['pending', 'in_progress', 'completed'])
        .withMessage('Status inválido'),
    body('due_date')
        .optional()
        .isISO8601()
        .withMessage('Data de vencimento inválida'),
    body('list_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('ID da lista inválido'),
    body('section_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('ID da seção inválido'),
    handleValidationErrors
];

const validateUpdateTask = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID da tarefa inválido'),
    body('title')
        .optional()
        .isLength({ min: 1, max: 255 })
        .withMessage('Título deve ter entre 1 e 255 caracteres')
        .trim(),
    body('description')
        .optional()
        .isLength({ max: 5000 })
        .withMessage('Descrição deve ter no máximo 5000 caracteres')
        .trim(),
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high'])
        .withMessage('Prioridade deve ser low, medium ou high'),
    body('status')
        .optional()
        .isIn(['pending', 'in_progress', 'completed'])
        .withMessage('Status inválido'),
    body('due_date')
        .optional({ nullable: true })
        .isISO8601()
        .withMessage('Data de vencimento inválida'),
    handleValidationErrors
];

// ===== VALIDADORES DE LISTAS =====

const validateCreateList = [
    body('name')
        .notEmpty()
        .withMessage('Nome da lista é obrigatório')
        .isLength({ min: 1, max: 100 })
        .withMessage('Nome deve ter entre 1 e 100 caracteres')
        .trim(),
    body('emoji')
        .optional()
        .isLength({ max: 10 })
        .withMessage('Emoji inválido'),
    body('color')
        .optional()
        .matches(/^#[0-9A-Fa-f]{6}$/)
        .withMessage('Cor deve estar no formato #RRGGBB'),
    handleValidationErrors
];

// ===== VALIDADORES DE SEÇÕES =====

const validateCreateSection = [
    body('name')
        .notEmpty()
        .withMessage('Nome da seção é obrigatório')
        .isLength({ min: 1, max: 100 })
        .withMessage('Nome deve ter entre 1 e 100 caracteres')
        .trim(),
    body('list_id')
        .notEmpty()
        .withMessage('ID da lista é obrigatório')
        .isInt({ min: 1 })
        .withMessage('ID da lista inválido'),
    handleValidationErrors
];

// ===== VALIDADORES DE SUBTAREFAS =====

const validateCreateSubtask = [
    body('task_id')
        .notEmpty()
        .withMessage('ID da tarefa é obrigatório')
        .isInt({ min: 1 })
        .withMessage('ID da tarefa inválido'),
    body('title')
        .notEmpty()
        .withMessage('Título é obrigatório')
        .isLength({ min: 1, max: 255 })
        .withMessage('Título deve ter entre 1 e 255 caracteres')
        .trim(),
    handleValidationErrors
];

// ===== VALIDADORES DE ID =====

const validateId = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID inválido'),
    handleValidationErrors
];

const validateUserId = [
    param('userId')
        .isInt({ min: 1 })
        .withMessage('ID do usuário inválido'),
    handleValidationErrors
];

// ===== VALIDADORES DE QUERY =====

const validateTaskQuery = [
    query('user_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('ID do usuário inválido'),
    query('list_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('ID da lista inválido'),
    query('status')
        .optional()
        .isIn(['pending', 'in_progress', 'completed'])
        .withMessage('Status inválido'),
    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    validateLogin,
    validateRegister,
    validateCreateTask,
    validateUpdateTask,
    validateCreateList,
    validateCreateSection,
    validateCreateSubtask,
    validateId,
    validateUserId,
    validateTaskQuery
};
