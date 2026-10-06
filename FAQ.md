# Clypra Open Core FAQ

This FAQ answers common questions regarding Clypra's Open Core model, licensing structure, usage permissions, and contributions.

---

### Why Open Core and not pure open source?

We believe that professional creative software should be highly accessible, which is why the core editor, graphics runtime, and shader effect packages are open-source and free forever. 

However, developing and maintaining a state-of-the-art video editor requires full-time engineering and substantial GPU/AI server infrastructure. The proprietary commercial AI layer (like automatic captioning, scene detection, and natural language editing) funds the development of the core open-source engine, ensuring Clypra remains active, modern, and independent of predatory venture capital or advertising.

---

### Can I fork Clypra?

**Yes!** Under the MIT License, you are fully permitted to fork the `clypra` desktop editor and the `clypra-studio` packages, modify them, and redistribute them.

However, please note:
* **Trademark**: You cannot use the "Clypra" name, branding, or logo for your fork or downstream projects. You must rename your fork (e.g., "MyEditor powered by Clypra core").
* **Proprietary code**: You cannot fork or copy the `clypra-api` worker backend or any of the commercial AI services, as they are proprietary and unlicensed.

---

### Can I use Clypra commercially?

**Yes.** You can use the Clypra desktop editor and Clypra Studio to edit and produce commercial videos (e.g., for YouTube, clients, films, marketing) with absolutely no restrictions or royalty obligations.

Furthermore, because the core editor and packages are under the MIT license, you can integrate Clypra's open-source packages (such as `@clypra-studio/engine`) into your own commercial applications, provided you preserve the original copyright notice and license text.

---

### What if Clypra shuts down?

Because the entire core editor and studio effects packages are MIT-licensed and hosted publicly, the project cannot be deleted or paywalled retrospectively. If the founding team ever stops developing Clypra, the community can immediately fork the repository and continue its development under the same terms. Your project files, presets, and customized setups will always remain yours.


