#!/usr/bin/env bash
# Ищет следы прежнего имени продукта в коде, данных и документации.
# Что именно допустимо и почему, описано в docs/old-brand-allowlist.md
# тремя столбцами «имя | где | почему». Собственного списка исключений
# у скрипта нет: править надо только реестр.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

registry='docs/old-brand-allowlist.md'
fail=0

# В коде имя живёт идентификатором: змеиным, в CamelCase или переменной окружения.
code_pat='\b(macro_[A-Za-z0-9]+|Macro[A-Z][A-Za-z0-9]*|MACRO_[A-Z0-9]+)'
# Документация, данные, стили и сценарии показывают имя ещё слагом и доменом.
slug_pat='\b(macro_[A-Za-z0-9]+|Macro[A-Z][A-Za-z0-9]*|MACRO_[A-Z0-9]+|macro-[A-Za-z0-9]+|macro\.(so|ai|com|io|dev|run|app|inc)\b)'

code_types=' rs sql ts tsx toml yml yaml sh go '
slug_types=' html mjs js md mdx json css py '

if [ ! -f "$registry" ]; then
  echo "Нет реестра разрешённых имён: $registry"
  exit 2
fi

rows=()

# Каждая строка реестра даёт пару «имя|где». В ячейке имён может быть несколько
# имён через запятую, в ячейке путей — несколько шаблонов через запятую.
load_registry() {
  local line name where n
  local -a cells
  while IFS= read -r line; do
    [[ $line == '|'* ]] || continue
    [[ $line == *'---'* ]] && continue
    IFS='|' read -r -a cells <<<"$line"
    [ "${#cells[@]}" -ge 4 ] || continue
    name=${cells[1]//\`/}
    where=${cells[2]//\`/}
    where=${where//,/ }
    name=${name# }
    name=${name% }
    if [ -z "$name" ] || [ "$name" = 'Имя' ]; then
      continue
    fi
    while IFS= read -r n; do
      n=${n# }
      n=${n% }
      [ -z "$n" ] && continue
      rows+=("$n|$where")
    done < <(printf '%s\n' "$name" | tr ',' '\n')
  done < "$registry"
}

# Разрешено ли это имя именно в этом файле.
allowed() {
  local file=$1 token=$2 entry name where g
  for entry in "${rows[@]}"; do
    name=${entry%%|*}
    [ "$token" = "$name" ] || continue
    where=${entry#*|}
    set -f
    for g in $where; do
      if [[ $file == $g ]]; then
        set +f
        return 0
      fi
    done
    set +f
  done
  return 1
}

bad=()

# Читает строки вида «файл:строка:имя» и складывает те, которым нет места в реестре.
scan_hits() {
  local file line token
  while IFS=: read -r file line token; do
    [ -n "$token" ] || continue
    if allowed "$file" "$token"; then
      continue
    fi
    bad+=("$file:$line $token")
  done
}

# Сканируются файлы, отслеживаемые git, и новые файлы вне игнорируемых папок,
# поэтому мусор сборки вроде node_modules и target в проверку не попадает.
tracked=()
while IFS= read -r -d '' f; do
  tracked+=("$f")
done < <(git ls-files -z --cached --others --exclude-standard 2>/dev/null)
# Вне рабочей копии git (например, в распакованном архиве) смотрим дерево целиком.
if [ "${#tracked[@]}" -eq 0 ]; then
  while IFS= read -r -d '' f; do
    tracked+=("${f#./}")
  done < <(find . -name .git -prune -o -name node_modules -prune -o -name target -prune -o -name dist -prune -o -name vendor -prune -o -type f -print0 2>/dev/null)
fi

code_files=()
slug_files=()
for f in ${tracked[@]+"${tracked[@]}"}; do
  case $f in
    scripts/check-old-brand.sh|docs/old-brand-allowlist.md) continue ;;
  esac
  ext=${f##*.}
  case $code_types in *" $ext "*) code_files+=("$f") ;; esac
  case $slug_types in *" $ext "*) slug_files+=("$f") ;; esac
done

load_registry
if [ "${#rows[@]}" -eq 0 ]; then
  echo "Реестр $registry не содержит ни одной строки с именами"
  exit 2
fi

if [ "${#code_files[@]}" -gt 0 ]; then
  scan_hits < <(printf '%s\0' "${code_files[@]}" | xargs -0 -r grep -nHoE "$code_pat" -- 2>/dev/null)
fi
if [ "${#slug_files[@]}" -gt 0 ]; then
  scan_hits < <(printf '%s\0' "${slug_files[@]}" | xargs -0 -r grep -nHoE "$slug_pat" -- 2>/dev/null)
fi

if [ "${#bad[@]}" -gt 0 ]; then
  echo "Прежнее имя продукта там, где его быть не должно:"
  printf '  %s\n' "${bad[@]:0:40}"
  if [ "${#bad[@]}" -gt 40 ]; then
    echo "  … и ещё $(( ${#bad[@]} - 40 )) мест"
  fi
  echo "Если имя осталось намеренно, ему место в $registry: имя | где | почему."
  fail=1
fi

scan_names() {
  local names
  names=$(find crates services apps/web/src packages -type f \( -name 'macro_*' -o -name '*_macro_*' \) 2>/dev/null | grep -v '/migrations/' | head -20)
  if [ -n "$names" ]; then
    echo "Старое имя в именах файлов:"
    printf '%s\n' "$names"
    fail=1
  fi
}

scan_names

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "ok: прежнего имени нет в коде, данных, документации и именах файлов"
