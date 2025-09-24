-- Update welcome email template with styled HTML
UPDATE `email_templates`
SET `body_html` = '<div style=\"font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);\">
    <!-- Header -->
    <div style=\"background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;\">
      <h1 style=\"color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;\">Dobrodošli u Smart City GSP!</h1>
    </div>

    <!-- Content -->
    <div style=\"padding: 40px 30px;\">
      <p style=\"color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;\">
        Pozdrav <strong>{{firstName}} {{lastName}}</strong>,
      </p>

      <p style=\"color: #555555; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;\">
        Vaš nalog je uspešno kreiran sa sledećim podacima:
      </p>

      <div style=\"background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 0 0 30px 0;\">
        <ul style=\"list-style: none; margin: 0; padding: 0;\">
          <li style=\"color: #555555; font-size: 14px; margin: 0 0 10px 0;\">
            <strong style=\"color: #333333;\">📧 Email:</strong> {{email}}
          </li>
          <li style=\"color: #555555; font-size: 14px; margin: 0 0 10px 0;\">
            <strong style=\"color: #333333;\">🔐 Šifra:</strong>
            <code style=\"background-color: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 4px; font-family: monospace;\">{{password}}</code>
          </li>
          <li style=\"color: #555555; font-size: 14px; margin: 0;\">
            <strong style=\"color: #333333;\">📅 Datum registracije:</strong> {{registrationDate}}
          </li>
        </ul>
      </div>

      <div style=\"text-align: center; margin: 35px 0;\">
        <a href=\"{{loginUrl}}\" style=\"background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);\">
          Uloguj se na platformu
        </a>
      </div>

      <div style=\"background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 30px 0;\">
        <p style=\"margin: 0; color: #856404; font-size: 14px; line-height: 1.5;\">
          <strong>⚠️ VAŽNO:</strong> Preporučujemo da promenite svoju šifru nakon prvog prijavljivanja.
        </p>
      </div>

      <p style=\"color: #555555; font-size: 14px; line-height: 1.6; margin: 25px 0 0 0;\">
        Ukoliko imate bilo kakvih pitanja, slobodno nas kontaktirajte.
      </p>
    </div>

    <!-- Footer -->
    <div style=\"background-color: #f8f9fa; padding: 25px 30px; border-top: 1px solid #e9ecef;\">
      <p style=\"color: #6c757d; font-size: 13px; margin: 0 0 5px 0; text-align: center;\">
        Srdačan pozdrav,
      </p>
      <p style=\"color: #495057; font-size: 14px; margin: 0; font-weight: 600; text-align: center;\">
        Smart City GSP Tim
      </p>
      <p style=\"color: #adb5bd; font-size: 12px; margin: 15px 0 0 0; text-align: center;\">
        © 2025 Smart City GSP. Sva prava zadržana.
      </p>
    </div>
  </div>'
WHERE `slug` = 'welcome-email';

-- Update password reset template with styled HTML
UPDATE `email_templates`
SET `body_html` = '<div style=\"font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);\">
    <!-- Header -->
    <div style=\"background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 40px 30px; text-align: center;\">
      <h1 style=\"color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;\">Resetovanje Lozinke</h1>
    </div>

    <!-- Content -->
    <div style=\"padding: 40px 30px;\">
      <p style=\"color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;\">
        Pozdrav <strong>{{firstName}}</strong>,
      </p>

      <p style=\"color: #555555; font-size: 15px; line-height: 1.6; margin: 0 0 25px 0;\">
        Dobili smo zahtev za resetovanje lozinke za Vaš nalog (<strong>{{email}}</strong>).
      </p>

      <div style=\"text-align: center; margin: 35px 0;\">
        <a href=\"{{resetUrl}}\" style=\"background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);\">
          Resetuj Lozinku
        </a>
      </div>

      <div style=\"background-color: #e3f2fd; border: 1px solid #90caf9; border-radius: 6px; padding: 15px; margin: 30px 0;\">
        <p style=\"margin: 0 0 10px 0; color: #1565c0; font-size: 14px; line-height: 1.5;\">
          <strong>⏰ Napomena:</strong> Ovaj link će biti aktivan sledeća <strong>{{expirationHours}} sata</strong>.
        </p>
        <p style=\"margin: 0; color: #1565c0; font-size: 13px; line-height: 1.5;\">
          Ukoliko niste Vi poslali ovaj zahtev, slobodno ignorišite ovaj email.
        </p>
      </div>

      <div style=\"background-color: #ffebee; border: 1px solid #ffcdd2; border-radius: 6px; padding: 15px; margin: 30px 0;\">
        <p style=\"margin: 0; color: #c62828; font-size: 13px; line-height: 1.5;\">
          <strong>🔒 Bezbednost:</strong> Iz bezbednosnih razloga, nikad ne delite ovaj link sa drugim osobama.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style=\"background-color: #f8f9fa; padding: 25px 30px; border-top: 1px solid #e9ecef;\">
      <p style=\"color: #6c757d; font-size: 13px; margin: 0 0 5px 0; text-align: center;\">
        Srdačan pozdrav,
      </p>
      <p style=\"color: #495057; font-size: 14px; margin: 0; font-weight: 600; text-align: center;\">
        Smart City GSP Tim
      </p>
      <p style=\"color: #adb5bd; font-size: 12px; margin: 15px 0 0 0; text-align: center;\">
        © 2025 Smart City GSP. Sva prava zadržana.
      </p>
    </div>
  </div>'
WHERE `slug` = 'password-reset';