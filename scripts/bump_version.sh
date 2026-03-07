#!/bin/zsh
set -e

project_root=$PWD

while getopts 'c:t:' opt;
do
    case "${opt}" in
        t)
            # Bump version by type: major, minor, patch
            version_type=$OPTARG

            # Bump package.json and get new version
            cd $project_root
            current_version=$(bunx npm version $version_type --no-git-tag-version)
            current_version=${current_version#v}  # strip leading 'v'

            # Bump Tauri config version
            bun --eval "
                const conf = await Bun.file('src-tauri/tauri.conf.json').json();
                conf.version = '$current_version';
                await Bun.write('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
            "

            # Bump Cargo.toml version and regenerate Cargo.lock
            sed -i.bak "s/^version = \".*\"/version = \"$current_version\"/" src-tauri/Cargo.toml
            rm -f src-tauri/Cargo.toml.bak
            cargo update --workspace --manifest-path src-tauri/Cargo.toml

            # Warn if CHANGELOG.md has no entry for this version
            if ! grep -q "^## $current_version" "$project_root/CHANGELOG.md" 2>/dev/null; then
                echo "⚠️  Warning: No CHANGELOG.md entry found for version $current_version"
                echo "   Release notes and auto-update dialog will use a fallback message."
                echo "   Add a '## $current_version' section to CHANGELOG.md before pushing the tag."
            fi

            # Commit changes and tag
            git add \
                $project_root/package.json \
                $project_root/src-tauri/tauri.conf.json \
                $project_root/src-tauri/Cargo.toml \
                $project_root/src-tauri/Cargo.lock \
                $project_root/CHANGELOG.md
            git commit -m "Release Pipali version $current_version"
            git tag $current_version
            ;;
        c)
            # Set specific version
            current_version=$OPTARG

            cd $project_root
            bunx npm version $current_version --no-git-tag-version

            bun --eval "
                const conf = await Bun.file('src-tauri/tauri.conf.json').json();
                conf.version = '$current_version';
                await Bun.write('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
            "

            # Bump Cargo.toml version and regenerate Cargo.lock
            sed -i.bak "s/^version = \".*\"/version = \"$current_version\"/" src-tauri/Cargo.toml
            rm -f src-tauri/Cargo.toml.bak
            cargo update --workspace --manifest-path src-tauri/Cargo.toml

            # Warn if CHANGELOG.md has no entry for this version
            if ! grep -q "^## $current_version" "$project_root/CHANGELOG.md" 2>/dev/null; then
                echo "⚠️  Warning: No CHANGELOG.md entry found for version $current_version"
                echo "   Release notes and auto-update dialog will use a fallback message."
                echo "   Add a '## $current_version' section to CHANGELOG.md before pushing the tag."
            fi

            git add \
                $project_root/package.json \
                $project_root/src-tauri/tauri.conf.json \
                $project_root/src-tauri/Cargo.toml \
                $project_root/src-tauri/Cargo.lock \
                $project_root/CHANGELOG.md
            git commit -m "Release Pipali version $current_version"
            git tag $current_version
            ;;
        ?)
            echo -e "Invalid command option.\nUsage: $(basename $0) [-t type] [-c version]"
            echo -e "  -t: Bump version by type (major, minor, patch)"
            echo -e "  -c: Set specific version"
            exit 1
            ;;
    esac
done

# Restore State
cd $project_root
