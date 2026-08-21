# Fase 5F — o que só vocês podem verificar

**Data:** 2026-08-21
**Status:** pendente

A fase inteira foi construída e revisada sem que ninguém conseguisse abrir o app: o
ambiente de trabalho não tinha `.env.local` nem alcance ao projeto Supabase. Testes de
lógica, tipos, lint e build foram garantidos; **comportamento de tela, não.**

Esta lista é o que ficou devendo. Está em ordem de valor, não de esforço.

## 1. A prova de que a fase funcionou

**É o critério de aceitação da 5F inteira.** Todo o resto do trabalho é inferência a
partir de onde `revalidatePath` aparece; esta é a única observação que prova que a
duplicação sumiu de verdade.

- Abrir o DevTools na aba **Network**, filtrando por documento.
- Em `/pipeline`, abrir a gaveta de um negócio e mudar o próximo passo.
- Esperado: **uma** requisição de Server Action. **Não** uma de action seguida de uma de RSC.

Se aparecerem duas, alguma coisa da F1 não pegou e vale avisar.

## 2. Nenhuma tela precisa de F5

Percorrer as sete telas fazendo uma escrita em cada, confirmando que o resultado aparece
sem recarregar:

| Tela | Escrita |
| --- | --- |
| `/pipeline` | mudar próximo passo, nome da conta, estágio; cadastrar negócio |
| `/implantacao` | mudar etapa; concluir uma implantação |
| `/kanban` | status, título, responsável, prazo, prioridade, checklist, comentário, anexo; criar tarefa |
| `/metas` | editar progresso (Enter), excluir, criar meta |
| `/playbooks` | criar playbook |
| `/hoje` | confirmar que o item some quando resolvido nas telas acima |
| `/painel` | leitura pura — só conferir que carrega |

Uma tela que exigir F5 significa que uma action não revalida a rota de onde foi chamada.
A correção é na action, **nunca** devolvendo um `router.refresh()` — isso traria de volta
a renderização dupla que a fase removeu.

## 3. Os dois casos que a revisão final pegou

Estes **não** aparecem no passeio do item 2: vivem em caminhos que o uso normal não
alcança. Foram corrigidos em código, e estes passos confirmam a correção.

- **Negócio já fechado:** abrir o mesmo negócio em duas abas. Ganhar numa. Na outra,
  clicar em "Ganhar". O cartão tem de sair do funil — antes da correção ele ficava lá,
  sem erro nenhum, até um F5.
- **Anexo já removido:** abrir a mesma tarefa em duas abas. Remover o mesmo anexo nas
  duas. O ✕ da segunda tem de surtir efeito — antes da correção ele não fazia
  absolutamente nada, repetidamente.

## 4. Os seletores respondem no clique

Em cada um dos três, o valor novo tem de aparecer **na hora**, sem esperar o servidor:

- `/pipeline` → gaveta → **estágio**
- `/implantacao` → gaveta → **etapa**
- `/kanban` → painel da tarefa → **status**

E o caminho de falha, com o DevTools em modo **offline**: o seletor mostra o valor novo,
volta ao anterior, e um aviso explica. **No status da tarefa isso é novidade** — antes
desta fase a escrita falhava em silêncio absoluto.

Confirmar também que trocar a etapa **não** faz o botão do rodapé dizer "Concluindo…".

## 5. O celular não pisca mais

- `/implantacao` no DevTools em modo dispositivo, largura **375px**, e **recarregar**.
- O quadro tem de nascer empilhado — sem nenhum quadro intermediário com seis colunas
  espremidas.
- Repetir com cache desabilitado e rede em "Slow 3G", que é onde a piscada aparecia com
  mais clareza.
- Alargar além de 768px: as colunas voltam lado a lado, uma por etapa.

## 6. Autenticação continua íntegra

Cinco minutos, e mexe em auth — por isso está na lista mesmo com a revisão tendo
considerado a mudança sólida:

1. Deslogado, abrir `/pipeline` → tem de redirecionar para `/login`.
2. Entrar → cai em `/hoje`, com nome e iniciais certos na barra lateral.
3. Logado, abrir `/login` → redireciona para `/hoje`.
4. Sair pelo botão da barra lateral → volta para `/login`, e `/hoje` não abre mais.
5. Recarregar uma tela várias vezes seguidas → nenhuma cai para o login sozinha.

## 7. Nada trava enquanto salva

Em `/pipeline`, com a gaveta aberta: digitar no próximo passo e, sem parar, rolar a
gaveta, abrir outro campo e digitar nele. Nada pode travar enquanto o "salvando…"
aparece. Clicar em "Ganhar" duas vezes rápido: o segundo clique não passa.

---

## Uma pergunta em aberto, para quem tem acesso ao painel

No painel do Supabase do projeto do app: **Authentication → JWT / Signing Keys**.

- Se o algoritmo for **assimétrico** (ECC/RSA), há um ganho ainda não colhido: trocar
  `auth.getUser()` por `auth.getClaims()` no middleware e em `requireProfile` elimina
  duas idas de rede por requisição, validando o token localmente com WebCrypto.
- Se for **segredo simétrico** (HS256), `getClaims()` cai no mesmo pedido de rede e não
  há ganho — a troca não deve ser feita.

A troca **não foi aplicada** justamente porque ninguém conseguiu verificar isso daqui, e
aplicá-la às cegas colocaria no código um comentário afirmando uma propriedade de
segurança que talvez não exista. Está descrita na 5F como F3, pronta para quando a
resposta aparecer.
