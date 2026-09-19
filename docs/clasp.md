# Sincronizar con clasp

`clasp` es la herramienta de Google para trabajar Apps Script desde la terminal.
Evita copiar y pegar los archivos a mano en el editor web.

## Estado

Ya está instalado y configurado en la máquina de Mauricio: Node.js v24, clasp
3.4 y la sesión de Google iniciada. Lo que sigue es para reinstalarlo en otra
máquina o si algo deja de andar.

## El circuito

```
editás en src/  →  git push        (queda versionado en GitHub)
                →  clasp push      (sube el código a Apps Script)
                →  clasp deploy    (publica una versión nueva, ya en vivo)
```

Sin el `deploy`, el código queda guardado en Apps Script pero los locales
siguen viendo la versión anterior. La implementación está fijada a un número de
versión, así que un `push` solo nunca afecta lo que está en uso.

## Comandos del día a día

```bash
clasp.cmd pull     # traer lo que se editó en el navegador
clasp.cmd push     # subir lo de acá
clasp.cmd deploy -i <ID_DE_IMPLEMENTACION> -d "qué cambió"
clasp.cmd list-deployments
clasp.cmd open-script
```

El ID de implementación no está en el repo. Sale de `clasp.cmd list-deployments`:
es el que está fijado a un número de versión (`@12`), no el `@HEAD`.

> **En PowerShell hay que escribir `clasp.cmd`, no `clasp`.** PowerShell bloquea
> los scripts `.ps1` que instala npm. El `.cmd` hace exactamente lo mismo sin
> tocar ninguna configuración de seguridad del sistema.

## Instalación desde cero

```bash
winget install OpenJS.NodeJS.LTS
npm install -g @google/clasp
clasp.cmd login
```

Después hay que **activar la API**: entrar a
[script.google.com/home/usersettings](https://script.google.com/home/usersettings)
y poner *API de Google Apps Script* en **Activado**. Sin eso, `push` falla con
`User has not enabled the Apps Script API`.

## `.clasp.json`

No se versiona (está en `.gitignore`) porque tiene el ID del proyecto. Se arma
copiando `.clasp.json.ejemplo`:

```json
{
  "scriptId": "EL_ID_DEL_PROYECTO",
  "rootDir": "src",
  "scriptExtensions": ".gs",
  "htmlExtensions": ".html"
}
```

`scriptExtensions` es lo que mantiene los archivos como `.gs` en vez de `.js`.
El `scriptId` sale de Apps Script, en Configuración del proyecto → ID de script.

## Nombres de archivo

Los archivos del proyecto no llevan acentos: el archivo se llama `Codigo`, no
`Código`. clasp nombra los archivos locales igual que los del proyecto, y un
acento en el nombre trae problemas de codificación en git y en la terminal.
