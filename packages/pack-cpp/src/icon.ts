/**
 * `cpp:icon`: platform app resources, separate from embedding – a Windows
 * .rc that attaches an icon to the executable, and the macOS .icns that goes
 * into the app bundle's Resources. jen only writes text, so the icon files
 * themselves are yours to drop into resources/.
 */
import type { Generator } from '@codejen/jen';

const iconGenerator: Generator = {
  description: 'wire a Windows .rc icon and a macOS .icns bundle icon into the executable (you supply the icon files)',
  params: {
    ico: { default: 'resources/app.ico' },
    icns: { default: 'resources/app.icns' },
  },
  actions: ({ ico, icns }) => {
    const icoPath = String(ico);
    const icnsPath = String(icns);
    const icnsFile = icnsPath.split('/').pop() ?? icnsPath;
    const rcPath = `${icoPath.slice(0, Math.max(0, icoPath.lastIndexOf('/')) || 0)}/app.rc`.replace(/^\//, '');

    const rc = `IDI_ICON1 ICON "${icoPath.split('/').pop()}"
`;
    const cmake = `if(WIN32)
  target_sources(\${PROJECT_NAME} PRIVATE \${PROJECT_SOURCE_DIR}/${rcPath})
elseif(APPLE)
  target_sources(\${PROJECT_NAME} PRIVATE \${PROJECT_SOURCE_DIR}/${icnsPath})
  set_source_files_properties(\${PROJECT_SOURCE_DIR}/${icnsPath} PROPERTIES MACOSX_PACKAGE_LOCATION Resources)
  set_target_properties(\${PROJECT_NAME} PROPERTIES MACOSX_BUNDLE_ICON_FILE ${icnsFile})
endif()`;

    return [
      { add: rcPath, template: rc },
      { insert: 'src/CMakeLists.txt', before: '# jen:app', line: cmake },
    ];
  },
};

export default iconGenerator;
