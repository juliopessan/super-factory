// Arquivos que a Factory guarda de cada repositório e de cada card, na pasta de dados: o mapa do repositório
// (só reescrito quando a lista de arquivos muda) e a captura de tela do app aberto no navegador do sandbox.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { hashDoArquivoDeMapa, mapaEmArquivo, type MapaDoRepositorio } from './mapa.ts'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function pastaDeDados(): string {
  return process.env.FACTORY_DATA_DIR ?? path.join(raiz, 'data')
}

function nomeSeguro(texto: string): string {
  return texto.replace(/[^A-Za-z0-9._-]+/g, '__').replace(/^\.+/, '_').slice(0, 120)
}

export function caminhoDoMapa(repositorio: string): string {
  return path.join(pastaDeDados(), 'mapas', `${nomeSeguro(repositorio)}.md`)
}

/** Grava o mapa só se o repositório mudou desde o último. Devolve true quando gravou. */
export function guardarMapaDoRepositorio(repositorio: string, mapa: MapaDoRepositorio): boolean {
  const arquivo = caminhoDoMapa(repositorio)
  try {
    if (hashDoArquivoDeMapa(fs.readFileSync(arquivo, 'utf8')) === mapa.hash) return false
  } catch {}
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  fs.writeFileSync(arquivo, mapaEmArquivo(repositorio, mapa))
  return true
}

export function lerMapaGuardado(repositorio: string): string | null {
  try {
    return fs.readFileSync(caminhoDoMapa(repositorio), 'utf8')
  } catch {
    return null
  }
}

/** Guarda a captura (PNG em base64) e devolve o caminho relativo à pasta do projeto. */
export function guardarCapturaDoApp(cardId: string, pngBase64: string): string | null {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(cardId) || !/^[A-Za-z0-9+/=]+$/.test(pngBase64)) return null
  const bytes = Buffer.from(pngBase64, 'base64')
  if (bytes.length < 100 || bytes.length > 3_000_000 || bytes.subarray(0, 4).toString('hex') !== '89504e47') return null
  const arquivo = path.join(pastaDeDados(), 'capturas', `${cardId}-app.png`)
  fs.mkdirSync(path.dirname(arquivo), { recursive: true })
  fs.writeFileSync(arquivo, bytes)
  return path.relative(raiz, arquivo)
}
