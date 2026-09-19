# Sincronizar con clasp

`clasp` es la herramienta de Google para trabajar Apps Script desde la terminal.
Permite versionar el código en git y subirlo con un comando, en vez de copiar y
pegar en el editor web.

## Requisitos

Node.js no está instalado en esta máquina. Descargarlo de
[nodejs.org](https://nodejs.org) (versión LTS).

## Instalación

```bash
npm install -g @google/clasp
clasp login
```

## Conectar este repo al proyecto

1. Abrir el proyecto en script.google.com
2. **Configuración del proyecto → ID de secuencia de comandos** — copiarlo
3. Copiar `.clasp.json.ejemplo` a `.clasp.json` y pegar el ID

```bash
cp .clasp.json.ejemplo .clasp.json
```

## Uso diario

```bash
clasp pull     # traer los cambios hechos en el editor web
clasp push     # subir los cambios hechos acá
clasp open     # abrir el proyecto en el navegador
```

`.clasp.json` está en `.gitignore` porque contiene el ID del proyecto.
