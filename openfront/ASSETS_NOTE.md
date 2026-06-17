# Excluded upstream assets

To keep this preservation copy lean, two pristine/regenerable upstream directories were excluded:
- `resources/maps/` (~374 MB of binary `.bin` map files)
- `map-generator/` (~124 MB, Go generator + generated output)

Restore them from upstream before building the APK:

```
git clone --depth 1 https://github.com/openfrontio/OpenFrontIO /tmp/of-upstream
cp -r /tmp/of-upstream/resources/maps   resources/maps
cp -r /tmp/of-upstream/map-generator    map-generator
```

All hand-written source and the mod changes are committed here.
