import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

type Passo = {
  titulo: string
  instrucao: string
  sucesso: RegExp
}

const PASSOS: Passo[] = [
  {
    titulo: 'Instalar o Node',
    instrucao: [
      'Abra o site nodejs.org e baixe a versão 22, a que diz LTS, se ela for 22.18 ou mais nova.',
      'Instale com o botão Continuar, sem mudar as opções.',
      'Feche e abra de novo o Terminal. Cole esta linha e aperte Enter:',
      'node -v',
      'Quando a resposta começar com v22, v23 ou um número maior, me avise com essa linha. Aí vamos para o próximo passo.',
    ].join('\n'),
    sucesso: /\bv(?:22\.(?:1[8-9]|[2-9]\d)|\d{3,}|(?:2[3-9]|[3-9]\d))\b/i,
  },
  {
    titulo: 'Abrir o Terminal',
    instrucao: [
      'No Mac, aperte Command e a barra de espaço, escreva Terminal e aperte Enter.',
      'No Windows, abra o menu Iniciar, escreva PowerShell e aperte Enter.',
      'Uma janela preta ou branca, com um cursor piscando, é o lugar certo.',
      'Quando ela estiver aberta, escreva aqui: terminal aberto.',
    ].join('\n'),
    sucesso: /terminal aberto|prompt|powershell|zsh|bash/i,
  },
  {
    titulo: 'Trazer a Super Factory para o computador',
    instrucao: [
      'Se esta é a primeira vez, cole estas três linhas, uma de cada vez:',
      'cd ~',
      'git clone https://github.com/juliopessan/super-factory.git',
      'cd super-factory',
      'Se a pasta super-factory já existe, não clone de novo. Cole estas linhas:',
      'cd ~/super-factory',
      'git fetch origin',
      'git checkout -B main origin/main',
      'Quando o Terminal parar de escrever e o cursor voltar, me diga o que apareceu na última linha.',
    ].join('\n'),
    sucesso: /cloning into|already up to date|fast-forward|branch 'main'|super-factory/i,
  },
  {
    titulo: 'Instalar as peças',
    instrucao: [
      'Ainda dentro da pasta super-factory, cole:',
      'npm install',
      'Espere. Pode levar um minuto. O fim saudável é uma linha com added e packages, ou up to date.',
      'Não use sudo. Se aparecer um erro, cole a mensagem inteira aqui. Continuamos neste passo.',
    ].join('\n'),
    sucesso: /added \d+ packages|up to date|audited \d+ packages/i,
  },
  {
    titulo: 'Ligar a Factory',
    instrucao: [
      'Cole:',
      'npm run dev',
      'Deixe essa janela aberta. O fim saudável é uma linha com 4721.',
      'A página fica em http://localhost:4721 e a Factory em http://localhost:4721/studio.',
    ].join('\n'),
    sucesso: /4721|ready in/i,
  },
  {
    titulo: 'Abrir no navegador',
    instrucao: [
      'Abra o Chrome ou o Safari e cole este endereço:',
      'http://localhost:4721',
      'A página diz Super Factory. Depois abra a Factory:',
      'http://localhost:4721/studio',
      'No chat da Factory, escreva: estou no passo 6. Se a página não abrir, cole o que o navegador mostrou.',
    ].join('\n'),
    sucesso: /p[aá]gina aberta|super factory abriu|factory aberta|passo 6 ok/i,
  },
  {
    titulo: 'Modo autônomo: Docker e chaves',
    instrucao: [
      'Sem este passo, a Factory já funciona e avisa quando a resposta é uma amostra. Ele libera o modo autônomo.',
      'Docker: no Mac, instale o Docker Desktop, ou o Colima, que é gratuito. Para o Colima, cole uma linha de cada vez:',
      'brew install colima docker',
      'colima start',
      'Confira com: docker info. Se a resposta trouxer Server Version, o Docker está pronto.',
      'Com o Colima, acrescente ao .env a linha DOCKER_HOST=unix:///Users/SEU_USUARIO/.colima/default/docker.sock, trocando SEU_USUARIO pelo resultado de whoami. Com o Docker Desktop, não precisa.',
      'Chaves: na pasta super-factory, cole: cp .env.example .env. Abra o arquivo .env e preencha só na sua máquina:',
      'ANTHROPIC_API_KEY, para o agente escrever código.',
      'GITHUB_TOKEN, para repositórios do GitHub, e AZURE_DEVOPS_ORG com AZURE_DEVOPS_PAT, para o Azure DevOps.',
      'Comece por um repositório de teste. Depois de salvar o .env, pare a Factory com Control e C e rode npm run dev de novo.',
      'Não cole chave, token ou senha neste chat.',
      'Quando terminar, ou se for ficar sem o modo autônomo, escreva: instalação pronta.',
    ].join('\n'),
    sucesso: /instala[cç][aã]o pronta|sem chave|j[aá] preenchi|server version/i,
  },
]

function passoDaFalha(relato: string): number | null {
  if (/eaddrinuse|address already in use|port(?:a)? 4721/i.test(relato)) return 5
  if (/enoent|package\.json|n[aã]o (?:encontrei|achei) (?:a )?pasta|not a git repository/i.test(relato)) return /package\.json|enoent/i.test(relato) ? 4 : 3
  if (/destination path .* exists|already exists and is not an empty directory/i.test(relato)) return 3
  if (/could not read username|authentication failed|repository not found/i.test(relato)) return 3
  if (/command not found: node|node: command not found|'node' is not recognized/i.test(relato)) return 1
  if (/\bv(?:1[0-9]|20|21)\b/.test(relato) && /node/i.test(relato)) return 1
  if (/eacces|permission denied|eperm/i.test(relato)) return 4
  if (/cannot find module|mastra: command not found|sh: mastra/i.test(relato)) return 4
  return null
}

function correcao(relato: string): string {
  if (/eaddrinuse|address already in use|port(?:a)? 4721/i.test(relato)) {
    return 'A Factory já está ligada nesta máquina. Não comece de novo. Abra http://localhost:4721 no navegador. Se quiser religar, feche a janela antiga do Terminal e só então cole npm run dev outra vez.'
  }
  if (/enoent|cannot find module|mastra: command not found|sh: mastra/i.test(relato)) {
    return 'O Terminal não está dentro da pasta super-factory, ou as peças ainda não foram instaladas. Cole cd ~/super-factory e, na linha seguinte, npm install. Ficamos neste passo.'
  }
  if (/destination path .* exists|already exists and is not an empty directory/i.test(relato)) {
    return 'A pasta já existe. Não clone de novo. Cole cd ~/super-factory, depois git fetch origin e git checkout -B main origin/main.'
  }
  if (/not a git repository/i.test(relato)) {
    return 'Esta pasta não é o projeto. Cole cd ~/super-factory e rode o comando de novo.'
  }
  if (/could not read username|authentication failed/i.test(relato)) {
    return 'O projeto é público. Não cole senha nem token. Confira a internet e cole de novo git clone https://github.com/juliopessan/super-factory.git dentro da sua pasta de usuário.'
  }
  if (/command not found: node|node: command not found|'node' is not recognized/i.test(relato)) {
    return 'O Node não ficou disponível neste Terminal. Feche o Terminal, abra outro e cole node -v. Se continuar faltando, volte ao instalador do Node e marque a opção que adiciona o Node ao caminho.'
  }
  if (/\bv(?:1[0-9]|20|21)\b/.test(relato)) {
    return 'Esta versão do Node é antiga para a Super Factory. Instale a versão 22.18 ou mais nova, feche o Terminal e cole node -v de novo.'
  }
  if (/eacces|permission denied|eperm/i.test(relato)) {
    return 'Não use sudo. Feche o Terminal, abra outro, entre na pasta com cd ~/super-factory e cole npm install de novo.'
  }
  return 'Continuamos neste passo. Cole a mensagem inteira, da primeira linha vermelha até a última, sem chave nem senha.'
}

export function conduzirInstalacao(entrada: { passo?: number; relato?: string } = {}): {
  passo: number
  total: number
  titulo: string
  instrucao: string
  pronto: boolean
} {
  const total = PASSOS.length
  const relato = entrada.relato?.trim() ?? ''
  const falha = relato ? passoDaFalha(relato) : null
  let passo = entrada.passo && entrada.passo >= 1 && entrada.passo <= total ? Math.floor(entrada.passo) : 1
  if (falha) passo = falha

  if (relato && falha) {
    const atual = PASSOS[passo - 1]
    return {
      passo,
      total,
      titulo: atual?.titulo ?? 'Instalação',
      instrucao: `${correcao(relato)}\n\n${atual?.instrucao ?? ''}`,
      pronto: false,
    }
  }

  if (relato && PASSOS[passo - 1]?.sucesso.test(relato) && passo < total) passo += 1
  if (relato && PASSOS[total - 1]?.sucesso.test(relato) && (entrada.passo === total || passo === total)) {
    return {
      passo: total,
      total,
      titulo: 'Instalação pronta',
      instrucao: 'A Super Factory está no ar. A página é http://localhost:4721 e a Factory é http://localhost:4721/studio. Um pedido entra pelo workflow autonomo ou pelo sdlc, e a única decisão humana é o merge. Eu não aprovo, não faço merge e não publico.',
      pronto: true,
    }
  }

  const atual = PASSOS[passo - 1] ?? PASSOS[0]
  return {
    passo,
    total,
    titulo: atual?.titulo ?? 'Instalação',
    instrucao: `Passo ${passo} de ${total}. ${atual?.titulo}.\n${atual?.instrucao}`,
    pronto: false,
  }
}

export const conduzirInstalacaoFerramenta = createTool({
  id: 'conduzir-instalacao',
  description: 'Conduz a instalação da Super Factory, um passo por vez. Se a pessoa colar um erro, fica nesse passo e explica o conserto.',
  inputSchema: z.object({
    passo: z.number().int().min(1).max(7).optional().describe('Passo atual, de 1 a 7. Vazio começa no 1.'),
    relato: z.string().optional().describe('O que a pessoa viu no Terminal ou no navegador, sem chave nem senha.'),
  }),
  outputSchema: z.object({
    passo: z.number(),
    total: z.number(),
    titulo: z.string(),
    instrucao: z.string(),
    pronto: z.boolean(),
  }),
  execute: async (entrada) => conduzirInstalacao(entrada),
})
