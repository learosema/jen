/**
 * `cpp:cpack`: install rules and CPack packaging. `install()` rules go in at
 * `# jen:install`, the CPack settings at `# jen:cpack` (which sits after it, so
 * `include(CPack)` always comes after every install rule).
 */
import type { Generator } from '@codejen/jen';

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>\${MACOSX_BUNDLE_BUNDLE_NAME}</string>
  <key>CFBundleDisplayName</key>
  <string>\${MACOSX_BUNDLE_BUNDLE_NAME}</string>
  <key>CFBundleIdentifier</key>
  <string>\${MACOSX_BUNDLE_GUI_IDENTIFIER}</string>
  <key>CFBundleExecutable</key>
  <string>\${MACOSX_BUNDLE_EXECUTABLE_NAME}</string>
  <key>CFBundleIconFile</key>
  <string>\${MACOSX_BUNDLE_ICON_FILE}</string>
  <key>CFBundleVersion</key>
  <string>\${MACOSX_BUNDLE_BUNDLE_VERSION}</string>
  <key>CFBundleShortVersionString</key>
  <string>\${MACOSX_BUNDLE_SHORT_VERSION_STRING}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`;

function installRules(assets: string, staticSdl: boolean): string {
  const sdl = staticSdl
    ? ''
    : `
# SDL3 as a shared library has to ship next to the executable.
if(TARGET SDL3::SDL3)
  get_target_property(sdl3_type SDL3::SDL3 TYPE)
  if(sdl3_type STREQUAL "SHARED_LIBRARY")
    get_target_property(sdl3_imported SDL3::SDL3 IMPORTED)
    if(sdl3_imported)
      install(IMPORTED_RUNTIME_ARTIFACTS SDL3::SDL3
        RUNTIME DESTINATION \${CMAKE_INSTALL_BINDIR}
        LIBRARY DESTINATION \${CMAKE_INSTALL_LIBDIR})
    else()
      install(TARGETS SDL3-shared
        RUNTIME DESTINATION \${CMAKE_INSTALL_BINDIR}
        LIBRARY DESTINATION \${CMAKE_INSTALL_LIBDIR})
    endif()
  endif()
endif()
`;
  return `include(GNUInstallDirs)

install(TARGETS \${PROJECT_NAME}
  RUNTIME DESTINATION \${CMAKE_INSTALL_BINDIR}
  BUNDLE DESTINATION .)
${sdl}
if(IS_DIRECTORY "\${PROJECT_SOURCE_DIR}/${assets}")
  install(DIRECTORY ${assets}/ DESTINATION \${CMAKE_INSTALL_DATADIR}/\${PROJECT_NAME})
endif()

# Let the installed binary find the libraries shipped next to it.
if(APPLE)
  set_target_properties(\${PROJECT_NAME} PROPERTIES INSTALL_RPATH "@executable_path/../\${CMAKE_INSTALL_LIBDIR}")
elseif(UNIX)
  set_target_properties(\${PROJECT_NAME} PROPERTIES INSTALL_RPATH "$ORIGIN/../\${CMAKE_INSTALL_LIBDIR}")
endif()

# macOS: build a proper .app bundle
set(BUNDLE_ID "BUNDLE_ID_PLACEHOLDER")
set_target_properties(\${PROJECT_NAME} PROPERTIES
  MACOSX_BUNDLE TRUE
  MACOSX_BUNDLE_INFO_PLIST "\${PROJECT_SOURCE_DIR}/cmake/Info.plist.in"
  MACOSX_BUNDLE_BUNDLE_NAME "\${PROJECT_NAME}"
  MACOSX_BUNDLE_GUI_IDENTIFIER "\${BUNDLE_ID}"
  MACOSX_BUNDLE_BUNDLE_VERSION "\${PROJECT_VERSION}"
  MACOSX_BUNDLE_SHORT_VERSION_STRING "\${PROJECT_VERSION}")`;
}

function cpackSettings(maintainer: string): string {
  return `set(CPACK_PACKAGE_NAME "\${PROJECT_NAME}")
set(CPACK_PACKAGE_VENDOR "${maintainer}")
set(CPACK_DEBIAN_PACKAGE_MAINTAINER "${maintainer}")
if(WIN32)
  set(CPACK_GENERATOR "ZIP;NSIS")  # or WIX; NSIS needs to be installed
elseif(APPLE)
  set(CPACK_GENERATOR "DragNDrop")
else()
  set(CPACK_GENERATOR "TGZ;DEB")
endif()
include(CPack)`;
}

const cpackGenerator: Generator = {
  description:
    'add install rules and CPack packaging (ZIP/NSIS, DragNDrop, TGZ/DEB), SDL3 runtime, RPATH and a macOS bundle',
  params: {
    assets: { default: 'assets' },
    staticSdl: { default: false },
    bundleId: { default: '' },
    maintainer: { default: '' },
  },
  actions: ({ assets, staticSdl, bundleId, maintainer }) => {
    const bundle = String(bundleId) || 'com.example.${PROJECT_NAME}';
    const who = String(maintainer) || '${PROJECT_NAME} maintainers';
    return [
      { add: 'cmake/Info.plist.in', template: INFO_PLIST },
      // set up before the install rules that read the variable
      ...(staticSdl
        ? [{ insert: 'CMakeLists.txt', before: '# jen:options', line: 'set(SDL_STATIC ON)\nset(SDL_SHARED OFF)' }]
        : []),
      {
        insert: 'CMakeLists.txt',
        before: '# jen:install',
        line: installRules(String(assets).replace(/\/+$/, ''), Boolean(staticSdl)).replace('BUNDLE_ID_PLACEHOLDER', bundle),
      },
      { insert: 'CMakeLists.txt', before: '# jen:cpack', line: cpackSettings(who) },
    ];
  },
};

export default cpackGenerator;
