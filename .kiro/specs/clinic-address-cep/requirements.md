# Requirements Document

## Introduction

Adicionar campos de endereço ao formulário de criação de conta do tipo clínica. O endereço deve ser preenchido automaticamente ao digitar o CEP, consultando a API ViaCEP através do backend. Caso o CEP não seja encontrado, o usuário deve ser informado para preencher manualmente. Os campos incluem CEP, endereço, número, complemento, bairro, cidade e estado. Todos obrigatórios exceto complemento, com opção "Sem número" no campo número.

## Glossary

- **Sistema_Backend**: Aplicação NestJS (pocketmed-backend) responsável pela API REST
- **Sistema_Frontend**: Aplicação React/Vite (pocketmed-web) responsável pela interface do usuário
- **Formulário_Cadastro_Clínica**: Tela de registro de conta do tipo clínica (Signup.tsx)
- **Serviço_CEP**: Módulo do backend que consome a API ViaCEP para consultar dados de endereço
- **ViaCEP_API**: API pública gratuita (https://viacep.com.br/ws/{cep}/json/) que retorna dados de endereço a partir de um CEP
- **Campo_CEP**: Campo de entrada para o Código de Endereçamento Postal (8 dígitos numéricos)
- **Checkbox_Sem_Número**: Checkbox que indica ausência de número no endereço
- **Mensagem_Informativa**: Alerta visual informando o usuário sobre uma condição

## Requirements

### Requirement 1: Endpoint de Consulta de CEP no Backend

**User Story:** Como desenvolvedor frontend, eu quero um endpoint no backend que consulte dados de endereço a partir de um CEP, para que o frontend não precise acessar APIs externas diretamente.

#### Acceptance Criteria

1. WHEN uma requisição GET é recebida com um CEP válido de 8 dígitos, THE Serviço_CEP SHALL consultar a ViaCEP_API e retornar os dados de endereço (logradouro, bairro, cidade, estado)
2. WHEN a ViaCEP_API retorna dados válidos para o CEP informado, THE Serviço_CEP SHALL responder com status 200 e um objeto contendo os campos: street, neighborhood, city e state
3. WHEN a ViaCEP_API indica que o CEP não foi encontrado (campo "erro": true), THE Serviço_CEP SHALL responder com status 404 e uma mensagem descritiva
4. WHEN o CEP informado não possui exatamente 8 dígitos numéricos, THE Serviço_CEP SHALL responder com status 400 e uma mensagem de validação
5. IF a ViaCEP_API estiver indisponível ou retornar erro de rede, THEN THE Serviço_CEP SHALL responder com status 502 e uma mensagem informando falha na consulta externa

### Requirement 2: Campos de Endereço na Entidade Clinic

**User Story:** Como administrador do sistema, eu quero que os dados de endereço da clínica sejam persistidos no banco de dados, para que possam ser consultados e exibidos posteriormente.

#### Acceptance Criteria

1. THE Sistema_Backend SHALL armazenar os seguintes campos de endereço na entidade Clinic: cep (varchar 9), street (varchar 255), number (varchar 20), complement (varchar 255 nullable), neighborhood (varchar 100), city (varchar 100), state (varchar 2), noNumber (boolean)
2. WHEN o campo noNumber for true, THE Sistema_Backend SHALL permitir que o campo number seja vazio ou nulo
3. WHEN o campo noNumber for false, THE Sistema_Backend SHALL exigir que o campo number contenha um valor não vazio
4. THE Sistema_Backend SHALL criar uma migration para adicionar as colunas de endereço à tabela clinics

### Requirement 3: Validação dos Campos de Endereço no Registro

**User Story:** Como usuário criando uma conta de clínica, eu quero que o sistema valide os campos de endereço durante o cadastro, para que meus dados sejam salvos corretamente.

#### Acceptance Criteria

1. WHEN uma requisição de criação de clínica é recebida, THE Sistema_Backend SHALL validar que os campos cep, street, neighborhood, city e state são obrigatórios e não vazios
2. WHEN o campo complement for enviado, THE Sistema_Backend SHALL aceitá-lo como opcional (pode ser vazio ou ausente)
3. WHEN o campo noNumber for true, THE Sistema_Backend SHALL dispensar a obrigatoriedade do campo number
4. WHEN o campo noNumber for false ou ausente, THE Sistema_Backend SHALL exigir que o campo number seja informado e não vazio
5. WHEN o campo cep não corresponder ao formato de 8 dígitos numéricos (com ou sem hífen no formato XXXXX-XXX), THE Sistema_Backend SHALL rejeitar a requisição com mensagem de validação

### Requirement 4: Preenchimento Automático de Endereço por CEP

**User Story:** Como usuário criando uma conta de clínica, eu quero que o endereço seja preenchido automaticamente ao digitar o CEP, para agilizar o preenchimento do formulário.

#### Acceptance Criteria

1. WHEN o usuário digita 8 dígitos numéricos no Campo_CEP, THE Formulário_Cadastro_Clínica SHALL automaticamente consultar o endpoint de CEP do backend
2. WHILE a consulta de CEP está em andamento, THE Formulário_Cadastro_Clínica SHALL exibir um indicador visual de carregamento no Campo_CEP
3. WHEN o backend retorna dados de endereço com sucesso, THE Formulário_Cadastro_Clínica SHALL preencher automaticamente os campos de endereço (street), bairro (neighborhood), cidade (city) e estado (state)
4. WHEN o backend retorna status 404 (CEP não encontrado), THE Formulário_Cadastro_Clínica SHALL exibir uma Mensagem_Informativa orientando o usuário a preencher o endereço manualmente
5. IF o backend retorna erro de rede ou status 502, THEN THE Formulário_Cadastro_Clínica SHALL exibir uma Mensagem_Informativa orientando o usuário a preencher o endereço manualmente

### Requirement 5: Layout dos Campos de Endereço

**User Story:** Como usuário criando uma conta de clínica, eu quero que os campos de endereço estejam organizados de forma clara e responsiva, para facilitar o preenchimento visual.

#### Acceptance Criteria

1. THE Formulário_Cadastro_Clínica SHALL exibir campos menores (CEP, número, estado) lado a lado na mesma linha quando houver espaço horizontal suficiente
2. THE Formulário_Cadastro_Clínica SHALL exibir campos maiores (endereço, bairro, cidade, complemento) ocupando largura total ou proporcionalmente maior
3. WHILE a largura da tela for insuficiente para disposição lado a lado, THE Formulário_Cadastro_Clínica SHALL empilhar os campos verticalmente (layout responsivo)

### Requirement 6: Checkbox "Sem Número"

**User Story:** Como usuário criando uma conta de clínica cujo endereço não possui número, eu quero marcar que não há número, para que o campo não seja obrigatório nesse caso.

#### Acceptance Criteria

1. THE Formulário_Cadastro_Clínica SHALL exibir um Checkbox_Sem_Número associado ao campo número
2. WHEN o usuário marca o Checkbox_Sem_Número, THE Formulário_Cadastro_Clínica SHALL desabilitar o campo número e limpar seu valor
3. WHEN o usuário desmarca o Checkbox_Sem_Número, THE Formulário_Cadastro_Clínica SHALL reabilitar o campo número como obrigatório
4. WHEN o Checkbox_Sem_Número está marcado, THE Formulário_Cadastro_Clínica SHALL enviar o campo noNumber como true na requisição ao backend

### Requirement 7: Validação Frontend dos Campos de Endereço

**User Story:** Como usuário criando uma conta de clínica, eu quero ver mensagens de erro claras ao deixar campos obrigatórios vazios, para saber o que preciso corrigir.

#### Acceptance Criteria

1. WHEN o usuário tenta submeter o formulário com campos obrigatórios de endereço vazios (cep, street, number, neighborhood, city, state), THE Formulário_Cadastro_Clínica SHALL exibir mensagens de erro individuais em cada campo não preenchido
2. WHEN o campo CEP contém menos de 8 dígitos numéricos, THE Formulário_Cadastro_Clínica SHALL exibir mensagem de erro indicando formato inválido
3. WHEN o Checkbox_Sem_Número está marcado, THE Formulário_Cadastro_Clínica SHALL remover a validação de obrigatoriedade do campo número
4. THE Formulário_Cadastro_Clínica SHALL utilizar Yup para definição do schema de validação dos campos de endereço integrado ao Formik
