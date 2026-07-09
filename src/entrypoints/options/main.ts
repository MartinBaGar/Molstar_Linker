import { mount } from 'svelte';
import App from './App.svelte';
import './style.css'; // Import your CSS here so Vite can bundle it!

const app = mount(App, {
    target: document.getElementById('app')!
});

export default app;
