/** `cpp:format`: a .clang-format matching the style the pack's generators emit (Google-based, 2 spaces). */
import type { Generator } from '@codejen/jen';

const formatGenerator: Generator = {
  description: 'add a .clang-format matching the generated code style (Google-based), aligned with .editorconfig',
  params: {
    basedOn: { default: 'Google' },
    indent: { default: '2' },
    columnLimit: { default: '120' },
  },
  actions: ({ basedOn, indent, columnLimit }) => {
    // Keep these in line with .editorconfig: indent_style = space, indent_size, end_of_line = lf,
    // insert_final_newline, and max_line_length for the column limit.
    const clangFormat = `BasedOnStyle: ${basedOn}
IndentWidth: ${indent}
ContinuationIndentWidth: ${Number(indent) * 2}
UseTab: Never
ColumnLimit: ${columnLimit}
LineEnding: LF
InsertNewlineAtEOF: true
Standard: Latest
`;
    return [{ add: '.clang-format', template: clangFormat }];
  },
};

export default formatGenerator;
