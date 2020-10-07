---
title: Make PDF
author: Pacharapol Withayasakpunt
date: October 5, 2020
latex: context
---
<!-- https://wiki.contextgarden.net/Layout -->
<!-- https://tex.stackexchange.com/questions/71048/how-to-set-the-page-layout-dimensions-in-context -->

\setuppapersize[A4, portrait]
\setuplayout[
  header=0pt,
  margin=2cm,
  footerdistance=0pt]

# Creating PDF's from markdown

With features that markdown normally won't have.

![](test.png)

\pagebreak

## So, I can use LaTeX inside Markdown

<%- include('ext.md') %>