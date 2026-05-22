/**
 * Tipografia do DetailGo — Inter (v3.19)
 *
 * Escala projetada para WCAG 2.1 AA:
 *  - Texto body ≥ 15px
 *  - Caption uppercase com letterSpacing para compensar tamanho menor
 *  - Pesos distintos reforçam hierarquia visual sem depender só de tamanho
 *
 * Uso nos componentes:
 *   fontFamily: T.family.regular | medium | semiBold | bold | extraBold
 *   fontSize:   T.size.caption | secondary | body | bodyLarge | title | titleLarge | display
 */

export const typography = {
  family: {
    /** 400 — textos longos, descrições, placeholders */
    regular: 'Inter-Regular',
    /** 500 — corpo de texto principal, metadados */
    medium: 'Inter-Medium',
    /** 600 — sub-títulos, labels de seção, botões secundários */
    semiBold: 'Inter-SemiBold',
    /** 700 — títulos de card, headers */
    bold: 'Inter-Bold',
    /** 800 — KPIs, números grandes, hero text */
    extraBold: 'Inter-ExtraBold',
  },

  size: {
    /** 11px — labels uppercase (compensar com fontWeight 700 + letterSpacing) */
    caption: 11,
    /** 13px — metadados, datas, textos de suporte */
    secondary: 13,
    /** 15px — corpo de texto padrão (≥14px WCAG AA) */
    body: 15,
    /** 17px — corpo em destaque, subtítulos de card */
    bodyLarge: 17,
    /** 20px — títulos de seção */
    title: 20,
    /** 24px — títulos de tela, headers */
    titleLarge: 24,
    /** 30px — números de KPI, hero */
    display: 30,
    /** 36px — display grande */
    displayLarge: 36,
  },

  lineHeight: {
    caption: 16,
    secondary: 18,
    body: 22,
    bodyLarge: 24,
    title: 28,
    titleLarge: 32,
    display: 38,
    displayLarge: 44,
  },
} as const;
