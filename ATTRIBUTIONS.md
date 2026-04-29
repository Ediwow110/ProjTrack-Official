This Figma Make file includes components from [shadcn/ui](https://ui.shadcn.com/) used under [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).

This Figma Make file includes photos from [Unsplash](https://unsplash.com) used under [license](https://unsplash.com/license).

Bootstrap Icons SVG path data is used in `src/app/components/ui/bootstrap-icon.tsx` for inline status icons. Bootstrap Icons are provided by The Bootstrap Authors under the MIT license: https://icons.getbootstrap.com/

Status and action icons use inline Bootstrap Icons SVG path data through the shared `BootstrapIcon`, `BootstrapIconButton`, and `BootstrapIconTooltip` components. Hover/focus helper text is rendered with the project tooltip component and keeps adjacent text labels so icons are not the only state signal.
