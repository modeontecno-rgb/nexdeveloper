-- 010_compilaciones.sql — NexDeveloper 0.10.0 «Compilaciones sin intervención»
-- Compila APK/AAB (Android), iOS, escritorio (Tauri) y web con GitHub Actions desde la propia app.

create table if not exists public.plantillas_compilacion (
  id text primary key,                          -- p. ej. 'capacitor-android'
  herramienta text not null,                    -- capacitor | flutter | react-native | tauri | web
  plataforma text not null,                     -- android | ios | escritorio | web
  nombre text not null,
  descripcion text,
  archivo_workflow text not null,               -- .github/workflows/nex-compilar-android.yml
  yaml text not null,
  secretos_firma text[] not null default '{}',  -- nombres de secretos del repositorio necesarios para firmar
  artefacto_patron text,                        -- nombre del artefacto que sube el taller
  ejecutor text not null default 'ubuntu-latest',
  minutos_estimados int not null default 8,
  orden int not null default 0
);
alter table public.plantillas_compilacion enable row level security;
drop policy if exists plantillas_compilacion_lectura on public.plantillas_compilacion;
create policy plantillas_compilacion_lectura on public.plantillas_compilacion for select to authenticated using (true);

create table if not exists public.compilaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  repositorio text not null,                    -- propietario/repo
  rama text not null default 'main',
  plantilla_id text not null references public.plantillas_compilacion(id),
  plataforma text not null,
  herramienta text not null,
  version text not null,
  firmada boolean not null default false,
  estado text not null default 'pendiente',     -- pendiente | enviada | en_curso | ok | error | cancelada
  run_id_github bigint,
  url_run text,
  artefacto_nombre text,
  artefacto_bytes bigint,
  artefacto_url_github text,
  ruta_remota text,                             -- clave en el almacén S3 propio (si hay destino)
  destino_id uuid,
  log_resumen text,
  error text,
  notas text,
  duracion_seg int,
  enviada_el timestamptz,
  iniciada_el timestamptz,
  terminada_el timestamptz,
  creado_el timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);
create index if not exists compilaciones_proyecto_idx on public.compilaciones(proyecto_id, creado_el desc);
create index if not exists compilaciones_estado_idx on public.compilaciones(estado) where estado in ('enviada','en_curso');
alter table public.compilaciones enable row level security;
drop policy if exists compilaciones_propietario on public.compilaciones;
create policy compilaciones_propietario on public.compilaciones for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Qué secretos de firma tiene puestos cada repositorio (solo nombres; los valores viven en GitHub)
create table if not exists public.firmas_compilacion (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  plataforma text not null,                     -- android | ios
  secretos_puestos text[] not null default '{}',
  actualizado_el timestamptz not null default now(),
  unique (proyecto_id, plataforma)
);
alter table public.firmas_compilacion enable row level security;
drop policy if exists firmas_compilacion_propietario on public.firmas_compilacion;
create policy firmas_compilacion_propietario on public.firmas_compilacion for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Última compilación por proyecto (para la ficha)
create or replace view public.v_compilaciones_ultimas as
  select distinct on (proyecto_id, plataforma) proyecto_id, plataforma, id, version, estado, url_run, artefacto_nombre, terminada_el, creado_el
  from public.compilaciones order by proyecto_id, plataforma, creado_el desc;

-- Sincronización periódica con GitHub (solo si hay compilaciones vivas)
create or replace function public.lanzar_sincronizacion_compilaciones()
returns void language plpgsql security definer set search_path to 'private','public' as $$
declare v_url text; v_token text;
begin
  if not exists (select 1 from public.compilaciones where estado in ('enviada','en_curso')) then return; end if;
  select valor into v_url from private.claves_sistema where clave = 'url_funciones';
  select valor into v_token from private.claves_sistema where clave = 'cron_token';
  if v_url is null or v_token is null then raise notice 'Faltan url_funciones o cron_token'; return; end if;
  perform net.http_post(
    url := v_url || '/compilar-app',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-token', v_token),
    body := jsonb_build_object('accion','sincronizar','programado', true));
end $$;
select cron.unschedule(jobid) from cron.job where jobname = 'compilaciones-sincronizar';
select cron.schedule('compilaciones-sincronizar', '*/2 * * * *', $$select public.lanzar_sincronizacion_compilaciones()$$);

-- Plantillas de talleres (GitHub Actions)
insert into public.plantillas_compilacion (id, herramienta, plataforma, nombre, descripcion, archivo_workflow, secretos_firma, artefacto_patron, ejecutor, minutos_estimados, orden, yaml) values
('capacitor-android','capacitor','android','Android (Capacitor) · APK y AAB','Aplicación web (Vite/React) empaquetada con Capacitor. Genera APK de pruebas siempre y AAB firmado si hay keystore.','.github/workflows/nex-compilar-android.yml','{ANDROID_KEYSTORE_BASE64,ANDROID_KEYSTORE_PASSWORD,ANDROID_KEY_ALIAS,ANDROID_KEY_PASSWORD}','android-*','ubuntu-latest',10,10,
$yaml$name: NexDeveloper · Compilar Android
on:
  workflow_dispatch:
    inputs:
      version:
        description: "Versión (p. ej. 1.4.0)"
        required: true
        default: "0.1.0"
jobs:
  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - name: Dependencias y build web
        run: |
          npm ci || npm install
          npm run build
      - name: Versión en package.json
        run: npm version "${{ github.event.inputs.version }}" --no-git-tag-version || true
      - name: Añadir Android si falta
        run: |
          if [ ! -d android ]; then npx cap add android; fi
          npx cap sync android
      - name: Keystore (si hay secretos)
        if: ${{ env.ANDROID_KEYSTORE_BASE64 != '' }}
        env: { ANDROID_KEYSTORE_BASE64: "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" }
        run: echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > android/app/nex-release.keystore
      - name: Compilar APK (debug) y AAB/APK (release)
        working-directory: android
        env:
          KS_PASS: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          KEY_PASS: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: |
          chmod +x gradlew
          ./gradlew assembleDebug --no-daemon
          if [ -f app/nex-release.keystore ]; then
            ./gradlew assembleRelease bundleRelease --no-daemon \
              -Pandroid.injected.signing.store.file=$PWD/app/nex-release.keystore \
              -Pandroid.injected.signing.store.password="$KS_PASS" \
              -Pandroid.injected.signing.key.alias="$KEY_ALIAS" \
              -Pandroid.injected.signing.key.password="$KEY_PASS"
          fi
      - name: Recoger artefactos
        run: |
          mkdir -p salida
          V="${{ github.event.inputs.version }}"
          find android/app/build/outputs -name "*.apk" -exec sh -c 'cp "$1" salida/app-$(basename "$1" .apk)-v'"$V"'.apk' _ {} \;
          find android/app/build/outputs -name "*.aab" -exec sh -c 'cp "$1" salida/app-$(basename "$1" .aab)-v'"$V"'.aab' _ {} \;
          ls -la salida
      - uses: actions/upload-artifact@v4
        with: { name: "android-v${{ github.event.inputs.version }}", path: salida, retention-days: 30 }
$yaml$),
('flutter-android','flutter','android','Android (Flutter) · APK y AAB','Proyecto Flutter. APK release siempre; firmado si hay keystore (key.properties).','.github/workflows/nex-compilar-android.yml','{ANDROID_KEYSTORE_BASE64,ANDROID_KEYSTORE_PASSWORD,ANDROID_KEY_ALIAS,ANDROID_KEY_PASSWORD}','android-*','ubuntu-latest',12,20,
$yaml$name: NexDeveloper · Compilar Android (Flutter)
on:
  workflow_dispatch:
    inputs:
      version: { description: "Versión", required: true, default: "0.1.0" }
jobs:
  android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - uses: subosito/flutter-action@v2
        with: { channel: stable }
      - run: flutter pub get
      - name: Keystore (si hay secretos)
        if: ${{ env.KS != '' }}
        env: { KS: "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" }
        run: |
          echo "$KS" | base64 -d > android/app/nex-release.keystore
          cat > android/key.properties <<EOF
          storePassword=${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          keyPassword=${{ secrets.ANDROID_KEY_PASSWORD }}
          keyAlias=${{ secrets.ANDROID_KEY_ALIAS }}
          storeFile=nex-release.keystore
          EOF
      - run: flutter build apk --release --build-name=${{ github.event.inputs.version }}
      - run: flutter build appbundle --release --build-name=${{ github.event.inputs.version }} || true
      - run: |
          mkdir -p salida
          cp build/app/outputs/flutter-apk/*.apk salida/ 2>/dev/null || true
          cp build/app/outputs/bundle/release/*.aab salida/ 2>/dev/null || true
      - uses: actions/upload-artifact@v4
        with: { name: "android-v${{ github.event.inputs.version }}", path: salida, retention-days: 30 }
$yaml$),
('capacitor-ios','capacitor','ios','iOS (Capacitor) · IPA','Aplicación web empaquetada con Capacitor. Sin certificados genera la app sin firmar; con certificado y perfil genera IPA firmado.','.github/workflows/nex-compilar-ios.yml','{APPLE_CERT_P12_BASE64,APPLE_CERT_PASSWORD,APPLE_PROVISION_PROFILE_BASE64,APPLE_TEAM_ID}','ios-*','macos-latest',18,30,
$yaml$name: NexDeveloper · Compilar iOS
on:
  workflow_dispatch:
    inputs:
      version: { description: "Versión", required: true, default: "0.1.0" }
jobs:
  ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: |
          npm ci || npm install
          npm run build
          if [ ! -d ios ]; then npx cap add ios; fi
          npx cap sync ios
      - name: Certificado y perfil (si hay secretos)
        if: ${{ env.P12 != '' }}
        env:
          P12: ${{ secrets.APPLE_CERT_P12_BASE64 }}
          P12_PASS: ${{ secrets.APPLE_CERT_PASSWORD }}
          PROFILE: ${{ secrets.APPLE_PROVISION_PROFILE_BASE64 }}
        run: |
          echo "$P12" | base64 -d > cert.p12
          security create-keychain -p nex nex.keychain
          security default-keychain -s nex.keychain
          security unlock-keychain -p nex nex.keychain
          security import cert.p12 -k nex.keychain -P "$P12_PASS" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple: -s -k nex nex.keychain
          mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
          echo "$PROFILE" | base64 -d > ~/Library/MobileDevice/Provisioning\ Profiles/nex.mobileprovision
          echo "FIRMAR=1" >> $GITHUB_ENV
      - name: Archivar
        working-directory: ios/App
        run: |
          pod install || true
          if [ "$FIRMAR" = "1" ]; then
            xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -archivePath $PWD/App.xcarchive archive DEVELOPMENT_TEAM=${{ secrets.APPLE_TEAM_ID }} MARKETING_VERSION=${{ github.event.inputs.version }}
            cat > exportOptions.plist <<EOF
          <?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>method</key><string>ad-hoc</string><key>teamID</key><string>${{ secrets.APPLE_TEAM_ID }}</string></dict></plist>
          EOF
            xcodebuild -exportArchive -archivePath $PWD/App.xcarchive -exportOptionsPlist exportOptions.plist -exportPath $PWD/salida
          else
            xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -sdk iphoneos -derivedDataPath build CODE_SIGNING_ALLOWED=NO MARKETING_VERSION=${{ github.event.inputs.version }} build
            mkdir -p salida && cd build/Build/Products/Release-iphoneos && zip -r ../../../../salida/App-sin-firmar-v${{ github.event.inputs.version }}.zip App.app
          fi
      - uses: actions/upload-artifact@v4
        with: { name: "ios-v${{ github.event.inputs.version }}", path: ios/App/salida, retention-days: 30 }
$yaml$),
('flutter-ios','flutter','ios','iOS (Flutter) · app sin firmar / IPA','Proyecto Flutter. Sin certificados compila sin firma; con certificados exporta IPA.','.github/workflows/nex-compilar-ios.yml','{APPLE_CERT_P12_BASE64,APPLE_CERT_PASSWORD,APPLE_PROVISION_PROFILE_BASE64,APPLE_TEAM_ID}','ios-*','macos-latest',20,40,
$yaml$name: NexDeveloper · Compilar iOS (Flutter)
on:
  workflow_dispatch:
    inputs:
      version: { description: "Versión", required: true, default: "0.1.0" }
jobs:
  ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with: { channel: stable }
      - run: flutter pub get
      - run: flutter build ios --release --no-codesign --build-name=${{ github.event.inputs.version }}
      - run: |
          mkdir -p salida && cd build/ios/iphoneos && zip -r ../../../salida/Runner-sin-firmar-v${{ github.event.inputs.version }}.zip Runner.app
      - uses: actions/upload-artifact@v4
        with: { name: "ios-v${{ github.event.inputs.version }}", path: salida, retention-days: 30 }
$yaml$),
('tauri-escritorio','tauri','escritorio','Escritorio (Tauri) · Mac, Windows y Linux','Aplicación de escritorio con Tauri; genera instaladores para los tres sistemas.','.github/workflows/nex-compilar-escritorio.yml','{}','escritorio-*','ubuntu-latest',25,50,
$yaml$name: NexDeveloper · Compilar escritorio
on:
  workflow_dispatch:
    inputs:
      version: { description: "Versión", required: true, default: "0.1.0" }
jobs:
  escritorio:
    strategy:
      matrix:
        os: [macos-latest, ubuntu-22.04, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: dtolnay/rust-toolchain@stable
      - if: matrix.os == 'ubuntu-22.04'
        run: sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
      - run: npm ci || npm install
      - uses: tauri-apps/tauri-action@v0
        env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" }
        with: { tagName: "v${{ github.event.inputs.version }}", releaseName: "v${{ github.event.inputs.version }}", releaseDraft: true }
      - uses: actions/upload-artifact@v4
        with: { name: "escritorio-${{ matrix.os }}-v${{ github.event.inputs.version }}", path: src-tauri/target/release/bundle, retention-days: 30 }
$yaml$),
('web-estatica','web','web','Web · paquete listo para servir','Compila la web (Vite) y entrega un zip con la carpeta dist para subir a cualquier servidor.','.github/workflows/nex-compilar-web.yml','{}','web-*','ubuntu-latest',5,60,
$yaml$name: NexDeveloper · Compilar web
on:
  workflow_dispatch:
    inputs:
      version: { description: "Versión", required: true, default: "0.1.0" }
jobs:
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: |
          npm ci || npm install
          npm run build
          mkdir -p salida && cd dist && zip -r ../salida/web-v${{ github.event.inputs.version }}.zip .
      - uses: actions/upload-artifact@v4
        with: { name: "web-v${{ github.event.inputs.version }}", path: salida, retention-days: 30 }
$yaml$)
on conflict (id) do update set yaml = excluded.yaml, descripcion = excluded.descripcion, secretos_firma = excluded.secretos_firma, nombre = excluded.nombre;
