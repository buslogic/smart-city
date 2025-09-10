# 🔐 Plan implementacije API Key sistema za Smart City platformu

## 📋 Pregled sistema

Sistem API ključeva omogućava sigurnu kontrolu pristupa API dokumentaciji i drugim zaštićenim resursima, sa mogućnošću praćenja korišćenja, revokovanja pristupa i detaljnog audit log-a.

## 🎯 Ciljevi implementacije

### Primarni ciljevi:
- Zaštititi Swagger dokumentaciju od neovlašćenog pristupa
- Omogućiti individualne pristupne kredencijale za svakog developera
- Implementirati sistem koji se lako održava i skalira
- Obezbediti potpunu vidljivost ko i kada pristupa sistemu

### Sekundarni ciljevi:
- Omogućiti različite nivoe pristupa (read-only, full access, admin)
- Implementirati automatsko istekanje ključeva
- Kreirati self-service portal za developere
- Integracija sa postojećim RBAC sistemom

## 🏗️ Arhitektura sistema

### 1. Struktura baze podataka

**Glavna tabela: `api_keys`**
- ID (UUID) - jedinstveni identifikator
- Key Hash - sigurno hash-ovan API ključ
- Display Key - poslednje 4 cifre za identifikaciju
- Name - opisno ime ključa (npr. "Production Swagger Access")
- Description - detaljan opis namene
- User ID - veza sa korisnikom koji je kreirao ključ
- Permissions - JSON array sa dozvolama
- Allowed IPs - lista dozvoljenih IP adresa (opciono)
- Rate Limit - maksimalan broj zahteva po satu
- Expires At - datum isteka ključa
- Last Used At - poslednje korišćenje
- Last Used IP - IP adresa poslednjeg korišćenja
- Usage Count - brojač korišćenja
- Created At - datum kreiranja
- Revoked At - datum revokovanja (ako je revokovan)
- Revoked By - ko je revokovao ključ
- Revoke Reason - razlog revokovanja

**Pomoćna tabela: `api_key_logs`**
- ID - jedinstveni identifikator
- API Key ID - veza sa ključem
- Action - tip akcije (access_granted, access_denied, key_validated)
- IP Address - IP adresa zahteva
- User Agent - browser/klijent informacije
- Endpoint - kojoj ruti je pristupljeno
- Response Code - HTTP status kod
- Response Time - vreme odziva u ms
- Created At - vreme događaja

### 2. Tipovi API ključeva

**Po nameni:**
- **Swagger Access** - samo za pristup dokumentaciji
- **API Access** - za programski pristup API-ju
- **Admin Access** - za administrativne operacije
- **Integration** - za eksterne servise i integracije

**Po trajanju:**
- **Permanent** - bez roka isteka (za interne servise)
- **Temporary** - sa definisanim rokom isteka
- **Session** - vezani za login sesiju
- **One-time** - jednokratni ključevi

### 3. Format ključa

```
sk_[environment]_[type]_[random_string]

Primeri:
sk_prod_swagger_xY3mN9pQ2rS5tU8vW1aB2cD3
sk_dev_api_zK8pL4mN7qR9sT2vX5yA6bC3
sk_test_admin_wE5rT8yU2iO4pA7sD9fG1hJ6
```

**Komponente:**
- `sk` - prefix za lako prepoznavanje
- `environment` - prod/dev/test/staging
- `type` - swagger/api/admin/integration
- `random_string` - 24 karaktera random string

## 🔄 Proces rada sa ključevima

### 1. Generisanje novog ključa

**Koraci:**
1. Admin ili ovlašćeni korisnik pristupa API Key Management panelu
2. Klikće na "Generate New Key"
3. Popunjava formu:
   - Ime ključa
   - Opis i namena
   - Tip ključa
   - Dozvole (checkboxes)
   - IP restrikcije (opciono)
   - Rok isteka (opciono)
   - Rate limit (opciono)
4. Sistem generiše jedinstveni ključ
5. Ključ se prikazuje SAMO JEDNOM (korisnik mora da ga sačuva)
6. U bazi se čuva samo hash ključa

**Sigurnosne mere:**
- Ključ se nikad ne čuva u plain text formatu
- Koristi se bcrypt ili argon2 za hešovanje
- Generisanje zahteva admin privilegije
- Svako generisanje se loguje

### 2. Korišćenje ključa

**Načini slanja:**
- Header: `X-API-Key: sk_prod_swagger_...`
- Query parameter: `?api_key=sk_prod_swagger_...`
- Bearer token: `Authorization: Bearer sk_prod_swagger_...`

**Proces validacije:**
1. Middleware ekstraktuje ključ iz zahteva
2. Proverava da li ključ postoji u bazi (po hash-u)
3. Proverava da li je ključ istekao
4. Proverava da li je ključ revokovan
5. Proverava IP adresu (ako ima restrikcije)
6. Proverava rate limit
7. Proverava dozvole za traženi resurs
8. Ažurira last_used podatke
9. Loguje pristup

### 3. Revokovanje ključa

**Razlozi za revokovanje:**
- Sigurnosni incident
- Zaposleni napustio kompaniju
- Ključ kompromitovan
- Istekao ugovor sa partnerom
- Administrativna odluka

**Proces:**
1. Admin pristupa listi ključeva
2. Pronalazi ključ koji treba revokovati
3. Klikće "Revoke Key"
4. Unosi razlog revokovanja
5. Sistem označava ključ kao revokovan
6. Svi budući pokušaji pristupa se odbijaju
7. Vlasnik ključa dobija email notifikaciju

## 📊 Admin panel funkcionalnosti

### Dashboard

**Statistike:**
- Ukupan broj aktivnih ključeva
- Broj ključeva po tipu
- Broj pristupa u poslednjih 24h
- Top 10 najkorišćenijih ključeva
- Ključevi koji ističu u narednih 30 dana
- Suspicious activity alerts

**Grafici:**
- API usage over time
- Pristup po satu/danu/mesecu
- Geografska distribucija pristupa
- Response time trends
- Error rate po ključu

### Lista ključeva

**Kolone tabele:**
- Ime ključa
- Tip
- Vlasnik
- Status (Active/Expired/Revoked)
- Poslednje korišćenje
- Broj korišćenja
- Datum isteka
- Akcije (View/Edit/Revoke/Logs)

**Filteri:**
- Po statusu
- Po tipu
- Po vlasniku
- Po datumu kreiranja
- Po datumu isteka
- Po IP restrikcijama

**Bulk akcije:**
- Revoke multiple keys
- Export lista u CSV
- Extend expiration
- Change rate limits

### Detaljan pregled ključa

**Informacije:**
- Svi podaci o ključu
- Istorija korišćenja (poslednih 100)
- IP adrese koje su koristile ključ
- Endpoints kojima je pristupano
- Response times
- Error logs

**Akcije:**
- Edit naziv i opis
- Update permissions
- Modify IP restrictions
- Extend expiration
- Change rate limit
- Regenerate key (nova vrednost)
- Revoke key

### Audit log

**Praćenje:**
- Ko je kreirao koji ključ
- Ko je revokovao koji ključ
- Promene na ključevima
- Failed authentication attempts
- Suspicious patterns
- Rate limit violations

## 🔒 Sigurnosne mere

### Osnovna zaštita
- HTTPS only komunikacija
- Ključevi se čuvaju hash-ovani
- Rate limiting na sve endpoints
- IP whitelisting opcija
- Automatic key rotation politika

### Napredna zaštita
- Two-factor authentication za generisanje ključeva
- Anomaly detection (neobičan pattern korišćenja)
- Geo-blocking opcije
- Time-based restrictions (radno vreme)
- Webhook notifications za events

### Compliance
- GDPR compliant logging
- Audit trail za 90 dana
- Right to be forgotten
- Data encryption at rest
- Regular security audits

## 📧 Notifikacije

### Email notifikacije za:
- Novi ključ kreiran
- Ključ ističe za 7 dana
- Ključ revokovan
- Suspicious activity detected
- Rate limit reached
- Login from new IP

### Webhook integracije:
- Slack notifications
- Teams notifications
- Custom webhook endpoints
- Syslog export
- SIEM integration

## 🚀 Faze implementacije

### Faza 1: MVP (1-2 nedelje)
- [x] Kreirati database shemu
- [x] Implementirati generisanje ključeva
- [x] Osnovni middleware za validaciju
- [x] Zaštititi Swagger endpoint
- [x] Osnovni admin panel (lista i kreiranje)

### Faza 2: Proširenje (2-3 nedelje)
- [ ] Detaljni audit log
- [ ] IP restrikcije
- [ ] Rate limiting
- [ ] Email notifikacije
- [ ] Dashboard sa statistikama

### Faza 3: Enterprise features (3-4 nedelje)
- [ ] Two-factor authentication
- [ ] Anomaly detection
- [ ] Webhook integracije
- [ ] API key rotation
- [ ] Self-service portal

### Faza 4: Optimizacija (ongoing)
- [ ] Performance tuning
- [ ] Caching strategija
- [ ] Load testing
- [ ] Security audit
- [ ] Documentation

## 📝 Dokumentacija za korisnike

### Za developere:
- Kako dobiti API ključ
- Kako koristiti ključ
- Best practices
- Troubleshooting guide
- API reference

### Za administratore:
- Kako generisati ključeve
- Kako upravljati ključevima
- Security policies
- Monitoring guide
- Incident response

## 🎯 KPI i metrike uspešnosti

### Tehnički KPI:
- Response time < 100ms za validaciju
- 99.9% uptime za servis
- 0 security breaches
- < 1% false positive rate

### Business KPI:
- Smanjen broj neovlašćenih pristupa na 0
- Vreme generisanja ključa < 1 minut
- Automatizovano 90% procesa
- Zadovoljstvo korisnika > 4.5/5

## 💰 Procena resursa

### Ljudski resursi:
- 1 Senior Backend Developer - 4 nedelje
- 1 Frontend Developer - 2 nedelje  
- 1 DevOps Engineer - 1 nedelja
- 1 QA Engineer - 1 nedelja

### Tehnički resursi:
- Dodatni Redis instance za caching
- Monitoring tools (Grafana/Prometheus)
- Email service (SendGrid/AWS SES)
- Backup storage za audit logs

## ⚠️ Rizici i mitigacije

### Rizik 1: Curenje API ključeva
**Mitigacija:** 
- Redovan audit exposed keys na GitHub
- Automatic rotation policy
- Webhook alerts za suspicious activity

### Rizik 2: DoS napadi
**Mitigacija:**
- Rate limiting
- Cloudflare protection
- Automatic blocking suspicious IPs

### Rizik 3: Insider threats
**Mitigacija:**
- Detailed audit logging
- Principle of least privilege
- Regular access reviews

## ✅ Checklist pre produkcije

### Sigurnost:
- [ ] Penetration testing završen
- [ ] Security audit passed
- [ ] SSL/TLS properly configured
- [ ] Secrets management implemented
- [ ] Backup strategy tested

### Funkcionalnost:
- [ ] Svi tipovi ključeva testirani
- [ ] Admin panel fully functional
- [ ] Notifikacije rade
- [ ] Rate limiting testiran
- [ ] Audit log verified

### Dokumentacija:
- [ ] API dokumentacija kompletna
- [ ] Admin guide napisana
- [ ] User guide dostupna
- [ ] Security policies defined
- [ ] Incident response plan ready

### Monitoring:
- [ ] Dashboards configured
- [ ] Alerts postavljen
- [ ] Logs centralizovani
- [ ] Metrics collected
- [ ] Health checks active

## 📞 Kontakti i podrška

### Tehnička podrška:
- Email: api-support@smart-city.rs
- Slack: #api-keys-support
- Documentation: docs.smart-city.rs/api-keys

### Security team:
- Security incidents: security@smart-city.rs
- Vulnerability reports: security@smart-city.rs
- Emergency hotline: +381 11 XXX XXXX

---

*Dokument verzija: 1.0*  
*Datum: Januar 2025*  
*Autor: Smart City Development Team*  
*Status: U pripremi za implementaciju*