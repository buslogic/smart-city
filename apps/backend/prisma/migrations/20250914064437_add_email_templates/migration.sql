-- CreateTable
CREATE TABLE `email_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `body_html` TEXT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'general',
    `variables` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `usage_count` INTEGER NOT NULL DEFAULT 0,
    `last_used_at` DATETIME(3) NULL,
    `created_by` INTEGER NOT NULL,
    `updated_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_templates_slug_key`(`slug`),
    INDEX `email_templates_slug_idx`(`slug`),
    INDEX `email_templates_category_idx`(`category`),
    INDEX `email_templates_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_templates` ADD CONSTRAINT `email_templates_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_templates` ADD CONSTRAINT `email_templates_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert initial email templates
INSERT INTO `email_templates` (`id`, `name`, `slug`, `subject`, `body`, `body_html`, `category`, `variables`, `is_active`, `usage_count`, `created_by`, `created_at`, `updated_at`)
VALUES
(UUID(), 'Dobrodošli Email', 'welcome-email', 'Dobrodošli u Smart City platformu, {{firstName}}!',
'Pozdrav {{firstName}} {{lastName}},

Dobrodošli u Smart City GSP platformu!

Vaš nalog je uspešno kreiran sa sledećim podacima:
- Email: {{email}}
- Šifra: {{password}}
- Datum registracije: {{registrationDate}}

Možete se ulogovati na sledeći link:
{{loginUrl}}

VAŽNO: Preporučujemo da promenite svoju šifru nakon prvog prijavljivanja.

Ukoliko imate bilo kakvih pitanja, slobodno nas kontaktirajte.

Srdačan pozdrav,
Smart City GSP Tim',
NULL,
'authentication',
'["firstName", "lastName", "email", "password", "registrationDate", "loginUrl"]',
true,
0,
1,
NOW(),
NOW()),

(UUID(), 'Resetovanje Lozinke', 'password-reset', 'Zahtev za resetovanje lozinke - Smart City GSP',
'Pozdrav {{firstName}},

Dobili smo zahtev za resetovanje lozinke za Vaš nalog ({{email}}).

Kliknite na sledeći link da biste resetovali lozinku:
{{resetUrl}}

Ovaj link će biti aktivan sledeća {{expirationHours}} sata.

Ukoliko niste Vi poslali ovaj zahtev, slobodno ignorišite ovaj email.

Napomena: Iz bezbednosnih razloga, nikad ne delite ovaj link sa drugim osobama.

Srdačan pozdrav,
Smart City GSP Tim',
NULL,
'authentication',
'["firstName", "email", "resetUrl", "expirationHours"]',
true,
0,
1,
NOW(),
NOW());