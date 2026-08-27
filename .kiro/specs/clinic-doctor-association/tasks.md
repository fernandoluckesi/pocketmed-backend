# Implementation Plan: Clinic-Doctor Association

## Overview

Implementação do sistema de associação entre clínicas e médicos na plataforma PocketMed. O plano segue uma abordagem incremental: primeiro a infraestrutura (entidade, migration, módulo), depois a lógica de convites, respostas, memberships, pesquisa e dashboard, com testes intercalados.

## Tasks

- [ ] 1. Set up module structure and data model
  - [ ] 1.1 Create the ClinicDoctorInvite entity and TypeORM migration
    - Create `src/clinic-doctor-association/entities/clinic-doctor-invite.entity.ts` with all columns (id, clinicId, doctorId, invitedBy, status enum, createdAt, updatedAt) and relations
    - Create TypeORM migration to generate `clinic_doctor_invites` table with composite index on (clinicId, doctorId, status) and index on doctorId
    - _Requirements: 1.1, 1.6_

  - [ ] 1.2 Create DTOs and module scaffolding
    - Create `src/clinic-doctor-association/dto/create-invite.dto.ts` with `doctorId` (UUID validation)
    - Create `src/clinic-doctor-association/dto/respond-invite.dto.ts` with `decision` (enum validation: 'accepted' | 'rejected')
    - Create `src/clinic-doctor-association/dto/search-doctor.dto.ts` with `crm` (1-10 digits) and `state` (2-letter UF)
    - Create `src/clinic-doctor-association/clinic-doctor-association.module.ts` importing TypeOrmModule for ClinicDoctorInvite, ClinicMembership, Doctor, Clinic, DoctorPermission entities, and NotificationsModule
    - Create empty `src/clinic-doctor-association/clinic-doctor-association.service.ts` and `src/clinic-doctor-association/clinic-doctor-association.controller.ts`
    - Register module in `app.module.ts`
    - _Requirements: 1.1, 2.7, 7.4_

- [ ] 2. Implement invite creation flow
  - [ ] 2.1 Implement createInvite service method
    - Validate that the target doctor exists (throw 404 if not)
    - Check for existing pending invite for same clinic-doctor pair (throw 409 if exists)
    - Check for active membership for same clinic-doctor pair (throw 409 if exists)
    - Create ClinicDoctorInvite with status "pending", clinicId from admin's active clinic, doctorId, and invitedBy from admin's ID
    - Send in-app notification to the doctor with clinic name and admin name, and push notification if device token exists
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 2.2 Implement POST /clinic-association/invites endpoint
    - Wire controller method with @Post('invites') decorator
    - Use @Roles('admin') guard to restrict access
    - Use @CurrentUser() decorator to get authenticated admin
    - Validate CreateInviteDto via ValidationPipe
    - Return 201 with created invite
    - _Requirements: 1.1_

  - [ ]\* 2.3 Write property tests for invite creation (Properties 1, 2)
    - **Property 1: Invite creation produces correct record**
    - **Property 2: Invite preconditions prevent invalid creation**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]\* 2.4 Write unit tests for invite creation
    - Test doctor not found → 404
    - Test pending invite exists → 409
    - Test active membership exists → 409
    - Test successful creation with notification
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 3. Implement invite response flow
  - [ ] 3.1 Implement respondToInvite service method
    - Load invite by ID, validate it belongs to the requesting doctor (throw 403 if not)
    - Validate invite status is "pending" (throw 400 if not)
    - Validate decision is "accepted" or "rejected" (throw 400 if invalid)
    - If accepted: update invite status to "approved", check for existing inactive membership to reactivate or create new ClinicMembership with role "doctor" and isActive true
    - Enforce 20-clinic limit: count doctor's active memberships, throw 422 if at limit
    - If rejected: update invite status to "rejected"
    - Wrap acceptance flow in a transaction (update invite + create/reactivate membership)
    - Send notification to admin with doctor name and decision
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1_

  - [ ] 3.2 Implement PATCH /clinic-association/invites/:id/respond endpoint
    - Wire controller with @Patch('invites/:id/respond')
    - Use @CurrentUser() for authenticated doctor
    - Validate RespondInviteDto
    - Return 200 on success
    - _Requirements: 2.1, 2.3_

  - [ ]\* 3.3 Write property tests for invite response (Properties 4, 5, 6, 7, 9)
    - **Property 4: Acceptance of a pending invite produces an active membership**
    - **Property 5: Rejection of a pending invite produces no membership**
    - **Property 6: Only pending invites accept responses**
    - **Property 7: Only valid decisions are accepted**
    - **Property 9: Multi-clinic limit enforcement**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.7, 4.1**

  - [ ]\* 3.4 Write unit tests for invite response
    - Test accept → membership created
    - Test accept with existing inactive membership → reactivated
    - Test reject → no membership created
    - Test respond to non-pending invite → 400
    - Test respond to another doctor's invite → 403
    - Test invalid decision value → 400
    - Test 20-clinic limit exceeded → 422
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 4.1_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement invite listing and cancellation
  - [ ] 5.1 Implement getReceivedInvites and getSentInvites service methods
    - getReceivedInvites: query invites by doctorId, join clinic for name, order by createdAt DESC
    - getSentInvites: query invites by clinicId, join doctor for name/specialty/crm, order by createdAt DESC
    - Return empty array if no results
    - _Requirements: 3.1, 3.2, 3.6_

  - [ ] 5.2 Implement cancelInvite service method
    - Load invite by ID, validate it belongs to admin's clinic (throw 403 if not)
    - Validate invite status is "pending" (throw 400 if not)
    - Update status to "cancelled"
    - _Requirements: 3.3, 3.4, 3.5_

  - [ ] 5.3 Implement listing and cancel endpoints
    - GET /clinic-association/invites/received — doctor lists received invites
    - GET /clinic-association/invites/sent — admin lists sent invites
    - PATCH /clinic-association/invites/:id/cancel — admin cancels pending invite
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]\* 5.4 Write property tests for invite listing (Property 8)
    - **Property 8: Invite listing returns complete and ordered results**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]\* 5.5 Write unit tests for listing and cancellation
    - Test received invites returns ordered results
    - Test sent invites returns ordered results with doctor details
    - Test cancel pending invite → status cancelled
    - Test cancel non-pending invite → 400
    - Test cancel invite from another clinic → 403
    - Test empty result returns []
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 6. Implement membership management
  - [ ] 6.1 Implement getMyClinics service method
    - Query active ClinicMembership records for the doctor, join clinic for name
    - Order by createdAt ascending
    - _Requirements: 4.2, 4.3_

  - [ ] 6.2 Implement removeMember and leaveClinic service methods
    - removeMember (admin action): validate admin role, validate membership exists and is active, check if removing self as last admin (throw 422), deactivate membership (isActive = false), send notification to doctor
    - leaveClinic (doctor action): validate membership exists and belongs to requesting doctor, validate membership is active (throw 400 if already inactive), deactivate membership, send notification to admin
    - Non-admin trying to remove another doctor → 403
    - Membership not found → 404
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ] 6.3 Implement membership endpoints
    - GET /clinic-association/memberships/my-clinics — doctor lists their clinics
    - DELETE /clinic-association/memberships/:id — doctor leaves clinic
    - DELETE /clinic-association/memberships/:id/remove — admin removes doctor
    - _Requirements: 4.2, 6.1, 6.2_

  - [ ]\* 6.4 Write property tests for membership (Properties 10, 14)
    - **Property 10: Doctor clinic listing returns complete and ordered memberships**
    - **Property 14: Membership deactivation sets isActive to false**
    - **Validates: Requirements 4.2, 6.1, 6.2**

  - [ ]\* 6.5 Write unit tests for membership management
    - Test getMyClinics returns ordered active memberships
    - Test admin removes doctor → isActive = false
    - Test doctor leaves clinic → isActive = false
    - Test last admin cannot be removed → 422
    - Test non-admin tries to remove another → 403
    - Test deactivate already inactive → 400
    - Test membership not found → 404
    - _Requirements: 4.2, 4.3, 4.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement CRM search
  - [ ] 8.1 Implement searchDoctorByCrm service method
    - Validate both crm and state are provided (throw 400 if missing)
    - Normalize CRM search to match both stored formats: "ESTADO-NUMERO" and "NUMERO/ESTADO"
    - Query doctor by normalized CRM, return name, specialty, crm, profileImage
    - Return 404 if no match found
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ] 8.2 Implement GET /clinic-association/doctors/search endpoint
    - Use @Query() with SearchDoctorDto validation
    - Restrict to admin role
    - Return DoctorSearchResult or 404
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]\* 8.3 Write property test for CRM search (Property 15)
    - **Property 15: CRM search normalization handles both stored formats**
    - **Validates: Requirements 7.1, 7.3**

  - [ ]\* 8.4 Write unit tests for CRM search
    - Test search with valid CRM/state → returns doctor
    - Test search with CRM stored as "ESTADO-NUMERO" → found
    - Test search with CRM stored as "NUMERO/ESTADO" → found
    - Test search with no results → 404
    - Test missing CRM or state → 400
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 9. Implement dashboard and data access controls
  - [ ] 9.1 Implement getClinicDashboard service method
    - Query doctors with role "doctor" and active membership in the clinic
    - Order alphabetically by name (case-insensitive)
    - For each doctor, count active DoctorPermissions (isActive=true, patientId not null)
    - Return DashboardResponse with doctors list
    - Handle empty state (no doctors) with appropriate message
    - _Requirements: 8.1, 8.3, 8.4_

  - [ ] 9.2 Implement getDoctorPatients service method
    - Validate requesting user has active membership in the clinic
    - Query patients with active DoctorPermission for the specified doctor
    - Return only patient id and name, alphabetically ordered
    - No clinical data exposed
    - _Requirements: 5.2, 5.3, 8.2_

  - [ ] 9.3 Implement dashboard and data access endpoints
    - GET /clinic-association/dashboard — admin views clinic dashboard
    - GET /clinic-association/dashboard/doctors/:doctorId/patients — admin views doctor's patients
    - Add guard to validate active membership for all clinic data endpoints (throw 403 if no active membership)
    - Implement data projection: admin sees only [name, email, specialty, crm] for doctors; secretary sees only [id, name, email] + linked doctors for patients
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 8.1, 8.2_

  - [ ]\* 9.4 Write property tests for dashboard and data access (Properties 11, 12, 13, 16, 17)
    - **Property 11: Data projection restricts exposed fields by role**
    - **Property 12: Doctor patient visibility restricted to own active permissions**
    - **Property 13: Dashboard excludes clinical data**
    - **Property 16: Dashboard doctor list is alphabetically ordered**
    - **Property 17: Dashboard patient count reflects only active direct permissions**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5, 8.1, 8.3**

  - [ ]\* 9.5 Write unit tests for dashboard and data access
    - Test dashboard returns doctors alphabetically
    - Test patient count uses only active direct permissions
    - Test no clinical data exposed in dashboard
    - Test admin data projection (only name, email, specialty, crm)
    - Test secretary data projection (only id, name, email + doctors)
    - Test no active membership → 403
    - Test no doctors in clinic → appropriate message
    - Test DB failure → 500 with friendly message
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 10. Implement invite expiration scheduler
  - [ ] 10.1 Implement InviteExpirationScheduler
    - Create `src/clinic-doctor-association/invite-expiration.scheduler.ts`
    - Use @Cron(CronExpression.EVERY_DAY_AT_2AM)
    - Query all invites with status "pending" and createdAt older than 30 days
    - Bulk update status to "expired"
    - Log count of expired invites
    - Handle errors gracefully (log and don't propagate)
    - _Requirements: 1.6_

  - [ ]\* 10.2 Write property test for invite expiration (Property 3)
    - **Property 3: Invite expiration targets only eligible invites**
    - **Validates: Requirements 1.6**

  - [ ]\* 10.3 Write unit test for scheduler
    - Test only pending invites older than 30 days are expired
    - Test invites with other statuses are not affected
    - Test recent pending invites are not affected
    - _Requirements: 1.6_

- [ ] 11. Implement "Pesquisar Médicos" tab UI in frontend (pocketmed-web)
  - [ ] 11.1 Add SearchWithViewToggle and search logic to "Pesquisar Médicos" tab
    - In `pocketmed-web/src/pages/Doctors/index.tsx`, replace the placeholder content in the "Pesquisar Médicos" tab with:
      - A `SearchWithViewToggle` component identical to the one in "Médicos da Clínica" tab, with placeholder "Buscar por nome, especialidade ou CRM..." and grid/list toggle buttons
      - Add separate state variables for the search tab: `searchDoctorTerm` and `searchView` (grid/list)
      - On search input change or submit, call the backend endpoint GET `/clinic-association/doctors/search` passing CRM and state extracted from the input
      - Display results using the same `DoctorCard` (grid) and `DoctorListRow` (list) components
      - Show empty state with appropriate message when no results
      - Show loading spinner while fetching
      - Add an "Enviar Convite" button on each doctor card/row result to trigger POST `/clinic-association/invites`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 1.1_

- [ ] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The project uses NestJS with TypeORM, MySQL, Jest and fast-check (already installed)
- Notifications reuse the existing NotificationsModule pattern
- ClinicMembership entity already exists and requires no schema changes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "8.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "8.2", "8.3", "8.4"] },
    { "id": 4, "tasks": ["3.1", "5.1", "5.2", "6.1", "6.2"] },
    { "id": 5, "tasks": ["3.2", "3.3", "3.4", "5.3", "5.4", "5.5", "6.3", "6.4", "6.5"] },
    { "id": 6, "tasks": ["9.1", "9.2", "10.1"] },
    { "id": 7, "tasks": ["9.3", "9.4", "9.5", "10.2", "10.3"] },
    { "id": 8, "tasks": ["11.1"] }
  ]
}
```
