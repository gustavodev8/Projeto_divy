const db = require('./database');

async function testLogin() {
    try {
        console.log('🔍 Testando estrutura da tabela users...\n');
        
        // Ver estrutura da tabela
        const columns = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        
        console.log('📋 Colunas da tabela users:');
        columns.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type})`);
        });
        
        console.log('\n👥 Usuários cadastrados:');
        const users = await db.query('SELECT id, name, email FROM users');
        users.forEach(user => {
            console.log(`   - ID: ${user.id} | Nome: ${user.name} | Email: ${user.email}`);
        });
        
        console.log('\n🔐 Testando login com "Administrador" e senha "admin123"...');
        const user = await db.get(
            `SELECT id, name, email FROM users 
             WHERE (name = ? OR email = ?) AND password = ?`,
            ['Administrador', 'Administrador', 'admin123']
        );
        
        if (user) {
            console.log('✅ LOGIN FUNCIONOU!');
            console.log('   Usuário:', user.name);
            console.log('   Email:', user.email);
        } else {
            console.log('❌ LOGIN FALHOU - credenciais não encontradas');
        }
        
        process.exit(0); // ✅ Encerra o processo
        
    } catch (err) {
        console.error('❌ Erro:', err.message);
        process.exit(1); // ✅ Encerra com erro
    }
}

testLogin();