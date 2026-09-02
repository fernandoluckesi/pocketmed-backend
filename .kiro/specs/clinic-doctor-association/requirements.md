# Requirements Document

## Introduction

Este documento define os requisitos para o sistema de associação entre clínicas e médicos na plataforma Hispora. A funcionalidade permite que clínicas convidem médicos para se associarem, que médicos aceitem ou rejeitem convites, e que ambas as partes possam encerrar a associação. O sistema segue o padrão de solicitação/aprovação já existente para acesso médico-paciente, adaptado para o contexto clínica-médico.

## Glossary

- **Sistema**: A plataforma Hispora (backend NestJS + frontend React)
- **Clínica**: Entidade organizacional cadastrada no sistema, representada pela entidade `Clinic`
- **Médico**: Profissional de saúde cadastrado no sistema, representado pela entidade `Doctor`
- **Admin_da_Clínica**: Médico com papel `admin` na `ClinicMembership` de uma clínica específica
- **Solicitação_de_Associação**: Registro de convite ou pedido de vínculo entre clínica e médico, com status pendente/aprovado/rejeitado
- **Associação**: Vínculo ativo entre um médico e uma clínica, representado por um registro `ClinicMembership` com `isActive = true`
- **Dashboard_da_Clínica**: Painel de gestão consolidada da clínica, acessível ao Admin_da_Clínica
- **Paciente_do_Médico**: Paciente que possui `DoctorPermission` ativa com um médico específico

## Requirements

### Requirement 1: Convite de Médico pela Clínica

**User Story:** Como Admin_da_Clínica, eu quero convidar um médico para se associar à minha clínica, para que o médico possa atender pacientes vinculado à clínica.

#### Acceptance Criteria

1. WHEN o Admin_da_Clínica envia um convite informando o ID (UUID) do médico, THE Sistema SHALL criar uma Solicitação_de_Associação com status "pending", clinicId da clínica ativa do admin, doctorId do médico convidado e registrar o ID do admin como invitedBy
2. IF o Admin_da_Clínica tenta convidar um médico que já possui uma Solicitação_de_Associação com status "pending" para a mesma clínica, THEN THE Sistema SHALL rejeitar a operação com erro indicando que já existe uma solicitação pendente para este médico
3. IF o Admin_da_Clínica tenta convidar um médico que já possui uma Associação ativa (isActive=true) na mesma clínica, THEN THE Sistema SHALL rejeitar a operação com erro indicando que o médico já está associado à clínica
4. WHEN a Solicitação_de_Associação é criada com sucesso, THE Sistema SHALL criar uma notificação in-app (persistida na tabela notifications) para o médico convidado contendo o nome da clínica e o nome do Admin_da_Clínica, e enviar push notification caso o médico possua device token registrado
5. IF o médico informado no convite não existe no sistema (nenhum registro com o UUID fornecido na tabela doctors), THEN THE Sistema SHALL rejeitar a operação com erro indicando que o médico não foi encontrado
6. IF a Solicitação_de_Associação não for respondida pelo médico dentro de 30 dias a partir da data de criação, THEN THE Sistema SHALL atualizar automaticamente o status da solicitação para "expired"

### Requirement 2: Resposta do Médico ao Convite

**User Story:** Como médico, eu quero aceitar ou rejeitar convites de clínicas, para que eu controle em quais clínicas desejo atuar.

#### Acceptance Criteria

1. WHEN o médico aceita uma Solicitação_de_Associação informando o ID da solicitação e a decisão "accepted", THE Sistema SHALL atualizar o status da Solicitação_de_Associação para "approved" e criar uma Associação (ClinicMembership) com role "doctor" e isActive true
2. WHEN o médico aceita uma Solicitação_de_Associação e já existe uma Associação inativa (isActive = false) para o mesmo par clínica-médico, THE Sistema SHALL reativar a Associação existente (isActive = true) em vez de criar um novo registro
3. WHEN o médico rejeita uma Solicitação_de_Associação informando o ID da solicitação e a decisão "rejected", THE Sistema SHALL atualizar o status para "rejected" sem criar nenhuma Associação
4. WHEN o médico responde a uma Solicitação_de_Associação, THE Sistema SHALL enviar uma notificação ao Admin_da_Clínica informando o nome do médico e a decisão (aceite ou rejeição) em até 5 segundos após o processamento da resposta
5. IF o médico tenta responder a uma Solicitação_de_Associação que não está com status "pending", THEN THE Sistema SHALL retornar erro 400 com mensagem "Esta solicitação já foi respondida"
6. IF o médico tenta responder a uma Solicitação_de_Associação destinada a outro médico, THEN THE Sistema SHALL retornar erro 403 com mensagem "Acesso negado"
7. IF o médico informa uma decisão diferente de "accepted" ou "rejected", THEN THE Sistema SHALL retornar erro 400 indicando que o valor da decisão é inválido

### Requirement 3: Listagem de Solicitações

**User Story:** Como médico ou Admin_da_Clínica, eu quero visualizar as solicitações de associação, para que eu acompanhe o status dos convites.

#### Acceptance Criteria

1. WHEN o médico consulta suas solicitações recebidas, THE Sistema SHALL retornar todas as Solicitações_de_Associação onde o médico é o destinatário, incluindo nome da clínica, status e data de criação, ordenadas por data de criação descendente
2. WHEN o Admin_da_Clínica consulta as solicitações enviadas pela clínica, THE Sistema SHALL retornar todas as Solicitações_de_Associação originadas da clínica, incluindo nome do médico, especialidade, CRM, status e data de criação, ordenadas por data de criação descendente
3. WHEN o Admin_da_Clínica cancela uma Solicitação_de_Associação pendente pertencente à sua clínica, THE Sistema SHALL atualizar o status da solicitação para "cancelled" e não a exibir mais nas listagens ativas
4. IF o Admin_da_Clínica tenta cancelar uma solicitação que não está pendente, THEN THE Sistema SHALL retornar erro 400 com mensagem "Somente solicitações pendentes podem ser canceladas"
5. IF o Admin_da_Clínica tenta cancelar uma Solicitação_de_Associação que pertence a outra clínica, THEN THE Sistema SHALL retornar erro 403 com mensagem "Acesso negado"
6. IF não existem Solicitações_de_Associação para o filtro consultado, THEN THE Sistema SHALL retornar uma lista vazia

### Requirement 4: Suporte Multi-Clínica para Médicos

**User Story:** Como médico, eu quero estar associado a múltiplas clínicas simultaneamente, para que eu possa atender em diferentes locais.

#### Acceptance Criteria

1. THE Sistema SHALL permitir que um médico possua Associações ativas com até 20 clínicas diferentes simultaneamente
2. WHEN o médico consulta suas clínicas, THE Sistema SHALL retornar todas as Associações ativas do médico ordenadas por data de ingresso ascendente, incluindo nome da clínica, papel e data de ingresso
3. THE Sistema SHALL manter a constraint de unicidade por par (clinicId, professionalId), impedindo duplicatas de Associação para a mesma clínica
4. IF uma tentativa de criar uma Associação duplicada para o mesmo par (clinicId, professionalId) ocorrer, THEN THE Sistema SHALL rejeitar a operação e retornar uma mensagem de erro indicando que o profissional já possui associação com a clínica

### Requirement 5: Limites de Acesso a Dados

**User Story:** Como Admin_da_Clínica, eu quero que os dados detalhados dos médicos e pacientes sejam protegidos, para que a privacidade dos profissionais e pacientes seja respeitada.

#### Acceptance Criteria

1. WHEN o Admin_da_Clínica consulta a lista de médicos da clínica, THE Sistema SHALL retornar exclusivamente os campos: nome, e-mail, especialidade e CRM de cada médico com Associação ativa à clínica, omitindo CPF, telefone, data de nascimento e senha
2. WHILE um médico possui Associação ativa à clínica, THE Sistema SHALL permitir que esse médico visualize somente os pacientes que possuem DoctorPermission com isActive=true vinculada ao próprio médico ou que foram criados por ele como pacientes shadow
3. WHEN o Admin_da_Clínica consulta o Dashboard_da_Clínica, THE Sistema SHALL exibir apenas dados consolidados: quantidade total de pacientes por médico e nomes dos pacientes vinculados, sem expor dados clínicos (consultas, exames, medicamentos, prescrições e resultados de exames)
4. IF um usuário sem Associação ativa (clinic_membership com isActive=true) tenta acessar qualquer endpoint de dados da clínica, THEN THE Sistema SHALL negar a requisição e retornar mensagem de erro indicando acesso negado
5. WHEN um usuário com role Secretary consulta a lista de pacientes da clínica, THE Sistema SHALL retornar exclusivamente os campos: identificador, nome e e-mail do paciente, juntamente com os médicos vinculados, sem expor telefone, data de nascimento, gênero ou dados clínicos

### Requirement 6: Remoção de Médico da Clínica

**User Story:** Como Admin_da_Clínica ou médico, eu quero encerrar a associação entre médico e clínica, para que o vínculo possa ser desfeito por qualquer uma das partes.

#### Acceptance Criteria

1. WHEN o Admin_da_Clínica remove um médico da clínica, THE Sistema SHALL desativar a Associação (isActive = false) do médico na clínica e retornar confirmação de sucesso
2. WHEN o médico decide sair de uma clínica, THE Sistema SHALL desativar a Associação (isActive = false) do médico na clínica e retornar confirmação de sucesso
3. WHEN uma Associação é desativada, THE Sistema SHALL enviar uma notificação push à outra parte informando o encerramento do vínculo em até 30 segundos após a desativação
4. IF o Admin_da_Clínica tenta remover a si próprio e é o único administrador ativo da clínica, THEN THE Sistema SHALL rejeitar a operação com erro indicando que o último administrador ativo não pode ser removido da clínica
5. IF um médico sem papel admin tenta remover outro médico da clínica, THEN THE Sistema SHALL rejeitar a operação com erro indicando acesso negado por falta de permissão administrativa
6. IF o Admin_da_Clínica ou médico tenta desativar uma Associação que já está inativa (isActive = false), THEN THE Sistema SHALL rejeitar a operação com erro indicando que a associação já se encontra inativa
7. IF a Associação referenciada não existe na clínica especificada, THEN THE Sistema SHALL rejeitar a operação com erro indicando que a associação não foi encontrada

### Requirement 7: Pesquisa de Médicos para Convite

**User Story:** Como Admin_da_Clínica, eu quero pesquisar médicos por CRM e estado, para que eu possa encontrar e convidar médicos ao meu time.

#### Acceptance Criteria

1. WHEN o Admin_da_Clínica informa o número do CRM (1 a 10 dígitos numéricos) e a sigla do estado (UF válida com 2 letras), THE Sistema SHALL retornar o médico correspondente com nome, especialidade, CRM e imagem de perfil
2. IF a pesquisa não encontra nenhum médico com o CRM e estado informados, THEN THE Sistema SHALL exibir mensagem indicando que o médico não foi encontrado
3. THE Sistema SHALL suportar ambos os formatos de CRM armazenados: "ESTADO-NUMERO" e "NUMERO/ESTADO", normalizando a entrada para buscar em ambos os formatos
4. IF o Admin_da_Clínica submete a pesquisa sem informar o número do CRM ou sem informar o estado, THEN THE Sistema SHALL exibir mensagem de erro indicando que ambos os campos são obrigatórios

### Requirement 8: Dashboard Consolidado da Clínica

**User Story:** Como Admin_da_Clínica, eu quero visualizar um painel com dados consolidados dos médicos e pacientes da clínica, para que eu tenha uma visão geral da operação.

#### Acceptance Criteria

1. WHEN o Admin_da_Clínica acessa o Dashboard_da_Clínica, THE Sistema SHALL exibir a lista de médicos associados (com role "doctor" e membership ativa na clínica) ordenada alfabeticamente por nome, apresentando para cada médico o nome, especialidade e a quantidade de pacientes ativos vinculados
2. WHEN o Admin_da_Clínica expande os detalhes de um médico no dashboard, THE Sistema SHALL exibir apenas os nomes dos pacientes vinculados ao médico em ordem alfabética, sem dados clínicos
3. THE Sistema SHALL calcular a contagem de pacientes com base apenas em DoctorPermissions ativas (isActive = true), considerando apenas vínculos diretos com pacientes (patientId), não contabilizando dependentes separadamente
4. IF a clínica não possui médicos associados com role "doctor" além do admin, THEN THE Sistema SHALL exibir a mensagem "Nenhum médico associado à clínica" no lugar da lista de médicos
5. IF ocorrer uma falha ao carregar os dados do Dashboard_da_Clínica, THEN THE Sistema SHALL exibir uma mensagem de erro indicando indisponibilidade temporária e permitir que o Admin_da_Clínica tente recarregar os dados
