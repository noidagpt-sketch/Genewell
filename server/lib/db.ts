import { Pool, QueryResult } from 'pg';
import crypto from 'crypto';

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
} else {
  console.warn('DATABASE_URL not configured - database features will be unavailable');
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255),
        phone VARCHAR(20),
        age INT,
        gender VARCHAR(50),
        location VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS quiz_responses (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        analysis_id VARCHAR(255) NOT NULL UNIQUE,
        quiz_data JSONB NOT NULL,
        personalization_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS quiz_submissions (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        user_phone VARCHAR(20),
        user_age INT,
        user_gender VARCHAR(50),
        user_location VARCHAR(255),
        quiz_data JSONB NOT NULL,
        analysis_id VARCHAR(255),
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        analysis_id VARCHAR(255) NOT NULL,
        plan_id VARCHAR(255) NOT NULL,
        add_ons TEXT[] DEFAULT ARRAY[]::TEXT[],
        total_price DECIMAL(10, 2) NOT NULL,
        payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
        instamojo_payment_id VARCHAR(255),
        instamojo_transaction_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS downloads (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        user_email VARCHAR(255),
        product_name VARCHAR(255) NOT NULL,
        plan_tier VARCHAR(50),
        pdf_record_id VARCHAR(255),
        download_url TEXT,
        email_sent BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purchase_id INT REFERENCES purchases(id) ON DELETE SET NULL,
        email_type VARCHAR(50) NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        sent_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_credentials (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS visitor_tracking (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(50),
        country VARCHAR(100),
        region VARCHAR(100),
        city VARCHAR(100),
        latitude DECIMAL(10, 7),
        longitude DECIMAL(10, 7),
        timezone VARCHAR(100),
        isp VARCHAR(255),
        page_visited VARCHAR(500),
        referrer TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS managed_products (
        id SERIAL PRIMARY KEY,
        plan_id VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        details JSONB DEFAULT '[]',
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        original_price DECIMAL(10,2),
        color VARCHAR(50) DEFAULT 'blue',
        icon VARCHAR(50) DEFAULT 'star',
        page_count INT DEFAULT 10,
        badge VARCHAR(100),
        popular BOOLEAN DEFAULT FALSE,
        visible BOOLEAN DEFAULT TRUE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_visitor_tracking_ip ON visitor_tracking(ip_address);
      CREATE INDEX IF NOT EXISTS idx_visitor_tracking_created ON visitor_tracking(created_at);
      CREATE INDEX IF NOT EXISTS idx_visitor_tracking_country ON visitor_tracking(country);

      CREATE INDEX IF NOT EXISTS idx_quiz_responses_user_id ON quiz_responses(user_id);
      CREATE INDEX IF NOT EXISTS idx_quiz_responses_analysis_id ON quiz_responses(analysis_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(payment_status);
      CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_quiz_submissions_email ON quiz_submissions(user_email);
      CREATE INDEX IF NOT EXISTS idx_downloads_user_email ON downloads(user_email);
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255);
    `);

    const adminCheck = await client.query('SELECT id FROM admin_credentials WHERE username = $1', ['genewell']);
    if (adminCheck.rows.length === 0) {
      const defaultHash = hashPassword('Jackyu@62');
      await client.query(
        'INSERT INTO admin_credentials (username, password_hash) VALUES ($1, $2)',
        ['genewell', defaultHash]
      );
      console.log('Default admin credentials created (username: genewell)');
    }

    const productsCheck = await client.query('SELECT COUNT(*) as count FROM managed_products');
    if (parseInt(productsCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO managed_products (plan_id, name, description, details, price, original_price, color, icon, page_count, badge, popular, visible, sort_order)
        SELECT 'free_blueprint', 'Starter Blueprint', 'Your personalized wellness foundation', '["Personalized sleep & circadian rhythm assessment","Stress resilience score with actionable tools","Top 5 daily habit recommendations","Evidence-based hydration & movement guidelines","90-day quick-start action checklist","Recommended lab tests with Indian lab pricing"]'::jsonb, 0, NULL, 'gray', 'gift', 8, 'Free Forever', false, true, 0
        WHERE NOT EXISTS (SELECT 1 FROM managed_products WHERE plan_id = 'free_blueprint')
      `);
      await client.query(`
        INSERT INTO managed_products (plan_id, name, description, details, price, original_price, color, icon, page_count, badge, popular, visible, sort_order)
        SELECT 'essential_blueprint', 'Essential Blueprint', 'Complete nutrition + fitness foundation', '["Everything in Starter Blueprint","Metabolic profile: BMR, TDEE, body composition analysis","Personalized macronutrient targets","Circadian-optimized meal timing framework","3-day structured training program","Progressive overload guide","Advanced stress management & sleep supplements","Diet-specific recommendations","Food intolerance substitution guide"]'::jsonb, 499, 999, 'blue', 'star', 14, '50% Off Launch', false, true, 1
        WHERE NOT EXISTS (SELECT 1 FROM managed_products WHERE plan_id = 'essential_blueprint')
      `);
      await client.query(`
        INSERT INTO managed_products (plan_id, name, description, details, price, original_price, color, icon, page_count, badge, popular, visible, sort_order)
        SELECT 'premium_blueprint', 'Premium Blueprint', 'The complete wellness transformation package', '["Everything in Essential Blueprint","Complete 7-day meal plan","Indian grocery shopping list","5-day periodized training program","Digestive health protocol","Skin health & nutrition guide","Evidence-based supplement stack","Recommended lab tests","Calorie targets","Hydration protocol"]'::jsonb, 999, 2499, 'green', 'zap', 22, 'Best Value', true, true, 2
        WHERE NOT EXISTS (SELECT 1 FROM managed_products WHERE plan_id = 'premium_blueprint')
      `);
      await client.query(`
        INSERT INTO managed_products (plan_id, name, description, details, price, original_price, color, icon, page_count, badge, popular, visible, sort_order)
        SELECT 'coaching_blueprint', 'Coaching Edition', 'Premium Blueprint + exclusive coaching content', '["Everything in Premium Blueprint","6-day periodized training","Habit formation science","Identity-based habit change framework","Mindset & accountability coaching","Weekly self-coaching worksheet","Advanced stress resilience","Overcoming obstacles playbook","90-day transformation timeline","Priority email support"]'::jsonb, 2999, 9999, 'orange', 'heart', 30, '70% Off Launch', false, true, 3
        WHERE NOT EXISTS (SELECT 1 FROM managed_products WHERE plan_id = 'coaching_blueprint')
      `);
      console.log('Default managed products seeded');
    }

    console.log('Database schema initialized successfully');
  } catch (err) {
    console.error('Error initializing database schema:', err);
    throw err;
  } finally {
    client.release();
  }
}

export async function query(text: string, params?: any[]): Promise<QueryResult> {
  if (!pool) {
    throw new Error('Database not configured. Please set DATABASE_URL environment variable.');
  }

  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 500) {
      console.log('Slow query', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

export async function getUser(email: string) {
  const result = await query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
}

export async function createUser(email: string, name?: string, phone?: string, age?: number, gender?: string, location?: string) {
  const result = await query(
    'INSERT INTO users (email, name, phone, age, gender, location) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [email, name, phone, age, gender, location]
  );
  return result.rows[0];
}

export async function getOrCreateUser(email: string, name?: string, phone?: string, age?: number, gender?: string, location?: string) {
  let user = await getUser(email);
  if (user) {
    await query(
      'UPDATE users SET name = COALESCE($2, name), phone = COALESCE($3, phone), age = COALESCE($4, age), gender = COALESCE($5, gender), location = COALESCE($6, location), updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id, name, phone, age, gender, location]
    );
    user = await getUser(email);
    return user;
  }
  return await createUser(email, name, phone, age, gender, location);
}

export async function updateUser(userId: number, data: any) {
  const { name, phone, age, gender, location } = data;
  const result = await query(
    'UPDATE users SET name = COALESCE($2, name), phone = COALESCE($3, phone), age = COALESCE($4, age), gender = COALESCE($5, gender), location = COALESCE($6, location), updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
    [userId, name, phone, age, gender, location]
  );
  return result.rows[0];
}

export async function saveQuizSubmission(data: {
  userId?: number;
  userName: string;
  userEmail: string;
  userPhone?: string;
  userAge?: number;
  userGender?: string;
  userLocation?: string;
  quizData: any;
  analysisId: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const result = await query(
    `INSERT INTO quiz_submissions (user_id, user_name, user_email, user_phone, user_age, user_gender, user_location, quiz_data, analysis_id, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [data.userId || null, data.userName, data.userEmail, data.userPhone, data.userAge, data.userGender, data.userLocation, JSON.stringify(data.quizData), data.analysisId, data.ipAddress, data.userAgent]
  );
  return result.rows[0];
}

export async function saveQuizResponse(userId: number, analysisId: string, quizData: any, personalizationData: any) {
  const result = await query(
    'INSERT INTO quiz_responses (user_id, analysis_id, quiz_data, personalization_data) VALUES ($1, $2, $3, $4) RETURNING *',
    [userId, analysisId, JSON.stringify(quizData), JSON.stringify(personalizationData)]
  );
  return result.rows[0];
}

export async function saveDownload(data: {
  userId?: number;
  userEmail: string;
  productName: string;
  planTier?: string;
  pdfRecordId?: string;
  downloadUrl?: string;
  emailSent?: boolean;
}) {
  const result = await query(
    `INSERT INTO downloads (user_id, user_email, product_name, plan_tier, pdf_record_id, download_url, email_sent)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.userId || null, data.userEmail, data.productName, data.planTier, data.pdfRecordId, data.downloadUrl, data.emailSent || false]
  );
  return result.rows[0];
}

export async function getPurchases(userId: number) {
  const result = await query(
    'SELECT * FROM purchases WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

export async function createPurchase(userId: number, analysisId: string, planId: string, addOns: string[], totalPrice: number) {
  const result = await query(
    'INSERT INTO purchases (user_id, analysis_id, plan_id, add_ons, total_price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [userId, analysisId, planId, addOns, totalPrice]
  );
  return result.rows[0];
}

export async function updatePurchasePaymentStatus(purchaseId: number, status: string, instamojoPaymentId?: string, instamojoTransactionId?: string) {
  const result = await query(
    'UPDATE purchases SET payment_status = $2, instamojo_payment_id = COALESCE($3, instamojo_payment_id), instamojo_transaction_id = COALESCE($4, instamojo_transaction_id), completed_at = CASE WHEN $2 = \'completed\' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE id = $1 RETURNING *',
    [purchaseId, status, instamojoPaymentId, instamojoTransactionId]
  );
  return result.rows[0];
}

export async function logEmail(userId: number, purchaseId: number | null, emailType: string, recipientEmail: string, subject: string) {
  const result = await query(
    'INSERT INTO email_logs (user_id, purchase_id, email_type, recipient_email, subject) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [userId, purchaseId, emailType, recipientEmail, subject]
  );
  return result.rows[0];
}

export async function updateEmailLogStatus(emailLogId: number, status: string, errorMessage?: string) {
  const result = await query(
    'UPDATE email_logs SET status = $2, error_message = $3, sent_at = CASE WHEN $2 = \'sent\' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE id = $1 RETURNING *',
    [emailLogId, status, errorMessage]
  );
  return result.rows[0];
}

export async function getAllUsers(limit: number = 100, offset: number = 0) {
  const result = await query(
    'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows;
}

export async function getUserWithPurchases(userId: number) {
  const userResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
  const purchasesResult = await query('SELECT * FROM purchases WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  const quizResult = await query('SELECT * FROM quiz_responses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);

  return {
    user: userResult.rows[0],
    purchases: purchasesResult.rows,
    latestQuiz: quizResult.rows[0],
  };
}

export async function getAdminCredentials(username: string) {
  const result = await query('SELECT * FROM admin_credentials WHERE username = $1', [username]);
  return result.rows[0];
}

export async function updateAdminPassword(username: string, newPassword: string) {
  const newHash = hashPassword(newPassword);
  const result = await query(
    'UPDATE admin_credentials SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE username = $1 RETURNING id, username',
    [username, newHash]
  );
  return result.rows[0];
}

export async function closePool() {
  await pool.end();
}
