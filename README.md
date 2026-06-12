# <img src="src-tauri/icons/icon.png" width="48" height="48" valign="middle" /> Gestão Escolar

O **Gestão Escolar** é um aplicativo desktop moderno desenvolvido para simplificar o planejamento pedagógico, controle de frequência e geração inteligente de grades horárias escolares. Construído com a robustez do **Tauri v2** em conjunto com a flexibilidade do **React**, **TypeScript** e **Tailwind CSS**.

---

## 🚀 Funcionalidades Principais

* ⚙️ **Configuração Escolar**: Definição flexível de turnos (matutino, vespertino, noturno), duração de aulas, intervalos e dias de funcionamento letivos.
* 📚 **Gerenciador de Disciplinas**: Cadastro e organização das matérias oferecidas pela instituição.
* 👨‍🏫 **Gestão de Professores**: Cadastro completo de docentes e definição detalhada de suas **disponibilidades semanais** de horários.
* 🏫 **Gerenciador de Turmas**: Criação de turmas e atribuição de disciplinas com suas respectivas cargas horárias semanais.
* 📅 **Visualizador de Grade Horária**: Exibição da grade de aulas e montagem dos horários de forma integrada.
* 📝 **Diário de Frequência & Infrequência**: Acompanhamento de presença dos alunos e emissão de alertas/relatórios de infrequência escolar.
* 📊 **Gráficos e Tabelas Customizados**: Telas de relatórios interativos e dinâmicos para a análise dos dados institucionais.
* 🔄 **Integração com Sistemas Externos**: Integração nativa com plataformas parceiras de educação (como `SGEdu` e `Saev`).

---

## 🛠️ Tecnologias Utilizadas

* **Core Desktop**: [Tauri v2](https://tauri.app/) (Rust)
* **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/)
* **Estilização**: [Tailwind CSS v4](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/) / Radix UI
* **Gerenciamento de Estado**: [Zustand](https://github.com/pmndrs/zustand)
* **Outras bibliotecas**: `lucide-react` para ícones, `jspdf` para exportação de relatórios, `sonner` para notificações.

---

## 💻 Como Rodar o Projeto Localmente

### Pré-requisitos
Certifique-se de ter instalado em sua máquina:
1. **Node.js** (recomenda-se versão LTS recente)
2. **Rust** e o compilador (necessário para o Tauri)
3. **pnpm** (gerenciador de pacotes)

### Passo a Passo

1. Instale as dependências do projeto:
   ```bash
   pnpm install
   ```

2. Execute o aplicativo em modo de desenvolvimento:
   ```bash
   pnpm tauri dev
   ```

3. Para gerar a build final de produção da sua plataforma:
   ```bash
   pnpm tauri build
   ```

---
