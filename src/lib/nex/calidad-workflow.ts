/**
 * Taller de GitHub Actions de referencia para el control de calidad.
 * Se copia tal cual a `.github/workflows/calidad.yml` del repositorio del proyecto.
 */
export const NOMBRE_TALLER = "calidad.yml";
export const RUTA_TALLER = ".github/workflows/calidad.yml";

export const TALLER_CALIDAD = `name: Control de calidad NexDeveloper

on:
  workflow_dispatch:
    inputs:
      version:
        description: Versión que se comprueba
        required: true
        default: 0.0.0

jobs:
  calidad:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Instalar dependencias
        run: npm ci || npm install

      - name: Preparar el registro de resultados
        run: |
          echo '[]' > resultado-calidad.json
          cat > registrar.sh <<'GUION'
          #!/usr/bin/env bash
          codigo="$1"; resultado="$2"; detalle="$3"; metrica="\${4:-{}}"
          jq --arg c "$codigo" --arg r "$resultado" --arg d "$detalle" --argjson m "$metrica" \\
            '. += [{codigo:$c, resultado:$r, detalle:$d, metrica:$m}]' \\
            resultado-calidad.json > tmp.json && mv tmp.json resultado-calidad.json
          GUION
          chmod +x registrar.sh

      - name: Tipos
        if: always()
        run: |
          if npx --no-install tsc --noEmit > tipos.txt 2>&1 || npx tsc --noEmit > tipos.txt 2>&1; then
            ./registrar.sh tipos ok "Sin errores de tipos"
          else
            ./registrar.sh tipos fallo "$(tail -c 800 tipos.txt)"
          fi

      - name: Compilación
        if: always()
        run: |
          if npm run build > build.txt 2>&1; then
            ./registrar.sh compilacion ok "La versión de producción compila"
          else
            ./registrar.sh compilacion fallo "$(tail -c 800 build.txt)"
          fi

      - name: Revisión de estilo
        if: always()
        run: |
          if ls eslint.config.* .eslintrc* >/dev/null 2>&1; then
            npx eslint . -f json -o eslint.json || true
            errores=$(jq '[.[].errorCount] | add // 0' eslint.json)
            avisos=$(jq '[.[].warningCount] | add // 0' eslint.json)
            if [ "$errores" -gt 0 ]; then
              ./registrar.sh eslint fallo "$errores errores y $avisos avisos" "{\\"errores\\":$errores,\\"avisos\\":$avisos}"
            elif [ "$avisos" -gt 0 ]; then
              ./registrar.sh eslint aviso "$avisos avisos de estilo" "{\\"errores\\":0,\\"avisos\\":$avisos}"
            else
              ./registrar.sh eslint ok "Sin avisos de estilo"
            fi
          else
            ./registrar.sh eslint omitido "El proyecto no tiene configuración de estilo"
          fi

      - name: Pruebas unitarias
        if: always()
        run: |
          if jq -e '.devDependencies.vitest // .dependencies.vitest' package.json >/dev/null 2>&1; then
            if npx vitest run --reporter=json --outputFile=vitest.json > vitest.txt 2>&1; then
              ./registrar.sh vitest ok "Todas las pruebas pasan"
            else
              ./registrar.sh vitest fallo "$(tail -c 800 vitest.txt)"
            fi
          else
            ./registrar.sh vitest omitido "El proyecto no tiene pruebas unitarias"
          fi

      - name: Pruebas de humo
        if: always()
        run: |
          if ls playwright.config.* >/dev/null 2>&1; then
            npx playwright install --with-deps chromium || true
            if npx playwright test --grep @humo > humo.txt 2>&1; then
              ./registrar.sh playwright_humo ok "Las pantallas principales responden"
            else
              ./registrar.sh playwright_humo fallo "$(tail -c 800 humo.txt)"
            fi
          else
            ./registrar.sh playwright_humo omitido "El proyecto no tiene pruebas de navegador"
          fi

      - name: Textos e idiomas
        if: always()
        run: |
          carpeta=""
          for c in src/i18n src/locales public/locales; do
            [ -d "$c" ] && carpeta="$c"
          done
          if [ -z "$carpeta" ]; then
            ./registrar.sh i18n omitido "El proyecto no tiene ficheros de idiomas"
          else
            faltan=0
            todas=$(find "$carpeta" -name '*.json' -exec jq -r 'paths(scalars) | join(".")' {} \\; | sort -u | wc -l)
            for f in $(find "$carpeta" -name '*.json'); do
              propias=$(jq -r 'paths(scalars) | join(".")' "$f" | sort -u | wc -l)
              faltan=$((faltan + todas - propias))
            done
            if [ "$faltan" -gt 0 ]; then
              ./registrar.sh i18n aviso "Faltan $faltan claves en algún idioma" "{\\"claves_faltantes\\":$faltan}"
            else
              ./registrar.sh i18n ok "Todos los idiomas tienen las mismas claves"
            fi
          fi

      - name: Claves en el código
        if: always()
        run: |
          coincidencias=$(grep -rInE 'sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,}|service_role|eyJ[A-Za-z0-9_-]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY' src public 2>/dev/null | grep -v node_modules | grep -v '/dist/' | grep -vi 'anon' | head -20 || true)
          if [ -n "$coincidencias" ]; then
            ./registrar.sh secretos_codigo fallo "$(echo "$coincidencias" | cut -c1-600)"
          else
            ./registrar.sh secretos_codigo ok "No hay claves escritas en el código"
          fi

      - name: Dependencias con fallos conocidos
        if: always()
        run: |
          npm audit --json > audit.json || true
          altas=$(jq '(.metadata.vulnerabilities.high // 0) + (.metadata.vulnerabilities.critical // 0)' audit.json)
          moderadas=$(jq '.metadata.vulnerabilities.moderate // 0' audit.json)
          if [ "$altas" -gt 0 ]; then
            ./registrar.sh npm_audit fallo "$altas dependencias con avisos altos o críticos" "{\\"altas\\":$altas,\\"moderadas\\":$moderadas}"
          elif [ "$moderadas" -gt 0 ]; then
            ./registrar.sh npm_audit aviso "$moderadas dependencias con avisos moderados" "{\\"altas\\":0,\\"moderadas\\":$moderadas}"
          else
            ./registrar.sh npm_audit ok "Sin avisos en las dependencias"
          fi

      - name: Reglas fijas del fabricante
        if: always()
        env:
          VERSION: \${{ github.event.inputs.version }}
        run: |
          fallos=""
          grep -riq 'powered by' src || fallos="$fallos falta «Powered by»;"
          grep -riqE 'wa\\.me|whatsapp' src || fallos="$fallos falta el enlace de WhatsApp;"
          [ -f CHANGELOG.md ] || [ -f src/CHANGELOG.md ] || fallos="$fallos falta CHANGELOG.md;"
          grep -rq "\\"$VERSION\\"" src package.json || fallos="$fallos la versión $VERSION no aparece en el código;"
          if [ -n "$fallos" ]; then
            ./registrar.sh reglas_fabricante fallo "$fallos"
          else
            ./registrar.sh reglas_fabricante ok "Marcas, CHANGELOG y versión correctos"
          fi

      - name: Rendimiento y accesibilidad
        if: always()
        run: |
          if [ -d dist ]; then
            npx serve -s dist -l 4173 &
            sleep 5
            if npx lighthouse http://localhost:4173 --quiet --chrome-flags="--headless --no-sandbox" \\
               --only-categories=performance,accessibility --output=json --output-path=lh.json; then
              rend=$(jq '.categories.performance.score * 100 | floor' lh.json)
              acc=$(jq '.categories.accessibility.score * 100 | floor' lh.json)
              if [ "$acc" -lt 70 ] || [ "$rend" -lt 50 ]; then
                ./registrar.sh lighthouse aviso "Rendimiento $rend, accesibilidad $acc" "{\\"rendimiento\\":$rend,\\"accesibilidad\\":$acc}"
              else
                ./registrar.sh lighthouse ok "Rendimiento $rend, accesibilidad $acc" "{\\"rendimiento\\":$rend,\\"accesibilidad\\":$acc}"
              fi
            else
              ./registrar.sh lighthouse omitido "No se ha podido medir la página"
            fi
          else
            ./registrar.sh lighthouse omitido "No hay carpeta dist que servir"
          fi

      - name: Avisos de la base de datos
        if: always()
        run: |
          ./registrar.sh advisors_seguridad omitido "Lo consulta NexDeveloper"
          ./registrar.sh advisors_rendimiento omitido "Lo consulta NexDeveloper"

      - name: Subir el resultado
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: resultado-calidad
          path: resultado-calidad.json
`;
