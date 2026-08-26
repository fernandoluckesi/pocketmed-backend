-- ============================================================
-- Reset completo do banco de dados (zera todas as tabelas)
-- Uso: mysql -u pocketmed_user -ppocketmed_pass pocketmed < scripts/reset-db.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM doctor_permissions;
DELETE FROM doctor_access_requests;
DELETE FROM appointments;
DELETE FROM medications;
DELETE FROM exams;
DELETE FROM exam_schedules;
DELETE FROM exam_schedule_items;
DELETE FROM clinic_memberships;
DELETE FROM secretary_profiles;
DELETE FROM clinic_admin_profiles;
DELETE FROM dependent_responsibles;
DELETE FROM dependents;
DELETE FROM patients;
DELETE FROM doctors;
DELETE FROM clinics;
DELETE FROM notifications;
DELETE FROM device_tokens;
DELETE FROM patient_access_logs;
DELETE FROM patient_diseases;
DELETE FROM patient_allergies;
DELETE FROM patient_vaccines;
DELETE FROM doctor_documents;
DELETE FROM financial_settings;
DELETE FROM financial_cost_centers;
DELETE FROM financial_convenios;
DELETE FROM financial_revenues;
DELETE FROM financial_expenses;
DELETE FROM financial_doctor_transfers;
DELETE FROM financial_cashflow_entries;
DELETE FROM audit_events;

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Banco zerado com sucesso!' AS status;
