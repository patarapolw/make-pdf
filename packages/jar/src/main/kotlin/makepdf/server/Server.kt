package makepdf.server

import com.google.gson.Gson
import io.javalin.Javalin
import io.javalin.http.staticfiles.Location
import io.javalin.plugin.json.FromJsonMapper
import io.javalin.plugin.json.JavalinJson
import io.javalin.plugin.json.ToJsonMapper
import makepdf.App
import org.yaml.snakeyaml.Yaml
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths
import java.util.*

object Server {
    private val gson = Gson()
    private val yaml = Yaml()

    private val jsonStore = mutableMapOf<String, Map<String, Any?>>()
    private val markdownStore = mutableMapOf<String, String>()

    val apiServer = makeApi()
    private val fileServer = makeFileServer(apiServer, "/file")
    private val webServer = makeWeb(apiServer)

    fun stop () {
        apiServer.stop()
        fileServer.stop()
        webServer.stop()
    }

    private fun makeApi(): Javalin {
        val app = Javalin.create {
            if (!App.isJar) {
                it.enableCorsForAllOrigins()
            }

            if (System.getenv("DEBUG") == "1") {
                it.enableDevLogging()
            }
            it.showJavalinBanner = false
        }.start(System.getenv("PORT")?.toInt() ?: if (!App.isJar) {
            24000
        } else 0)

        app.get("config") { ctx ->
            val file = Paths.get(App.userRoot, "config.yaml").toFile()

            ctx.json(if (file.exists()) {
                yaml.load(file.inputStream())
            } else mapOf<String, Any>())
        }

        app.get("parse/*") { ctx ->
            val format = ctx.queryParam<String>("format")
                    .check({ fmt -> listOf("json", "markdown").contains(fmt) })
                    .get()

            val p = ctx.path().substring("parse".length + 1)
            val file = Paths.get(App.userRoot, p
                    .replace("/", File.separator)).toFile()

            if (file.exists()) {
                val fileContent = file.readText()
                val segments = if (fileContent.startsWith("---")) {
                    fileContent.split(Regex("(?s)\\r?\\n-{3}\\r?\\n"), limit = 2)
                            .toMutableList()
                } else {
                    mutableListOf("", fileContent)
                }

                while (segments.size < 2) {
                    segments.add("")
                }

                val id = UUID.randomUUID().toString()
                when (format) {
                    "json" -> {
                        try {
                            jsonStore[id] = yaml.load(segments[0])
                        } catch (e: Error) {}
                    }
                    "markdown" -> {
                        markdownStore[id] = segments[1]
                    }
                }
                ctx.redirect(
                        "http://localhost:${
                            app.port()
                        }/?format=$format&id=$id"
                )

                return@get
            }

            ctx.status(404)
        }

        return app
    }

    private fun makeWeb(apiServer: Javalin): Javalin {
        val app = Javalin.create {
            it.addStaticFiles("/public")
            it.addSinglePageRoot("/", "/index.html")
            it.showJavalinBanner = false
        }.start(0)

        app.get("/") { ctx ->
            val id = ctx.queryParam<String>("id").getOrNull()
            if (id == null) {
                ctx.redirect("/index.html")
            } else {
                ctx.result(markdownStore[id] ?: "")
            }
        }

        apiServer.get("/") {
            it.redirect(
                    "http://localhost:${app.port()}"
            )
        }

        return app
    }

    @Suppress("SameParameterValue")
    private fun makeFileServer(apiServer: Javalin, path: String): Javalin {
        val app = Javalin.create {
            it.addStaticFiles(App.userRoot, Location.EXTERNAL)
            it.showJavalinBanner = false

            it.requestLogger { ctx, _ -> ctx.path() }
        }.start(0)

        app.get("/") { ctx ->
            val id = ctx.queryParam<String>("id").getOrNull()
            if (id == null) {
                ctx.redirect("/index.html")
            } else {
                when(ctx.queryParam<String>("format").get()) {
                    "json" -> ctx.json(jsonStore[id] ?: mapOf<String, Any?>())
                    "markdown" -> {
                        val markdown = markdownStore[id] ?: ""

                        if (markdown.isNotEmpty()) {
                            val tab = App.browser.createTab()
                            val devTools = App.browser
                                    .createDevToolsService(tab)

                            val page = devTools.page
                            val dom = devTools.dom
                            val runtime = devTools.runtime

                            devTools.css.enable()

                            page.enable()
                            dom.enable()
                            runtime.enable()
                            runtime.addBinding("onHTML")

                            page.onLoadEventFired {
                                runtime.onBindingCalled {
                                    page.printToPDF().data
                                }
                            }

                            val root = File(App.userRoot).toPath()
                            Files.walk(root).filter { p ->
                                Files.isRegularFile(p) && p.toFile().extension == "md"
                            }.map {
                                val f = it.relativize(root).toString().replace(File.separator, "/")

                                page.navigate("http://localhost:${Server.apiServer.port()}/file/${f}")
                            }

                            devTools.waitUntilClosed()
                            App.browser.closeTab(tab)
                        }
                    }
                }
            }
        }

        apiServer.get("$path/*") {
            val p = it.path().substring(path.length + 1)
            it.redirect(
                    "http://localhost:${app.port()}/$p"
            )
        }

        return app
    }

    init {
        JavalinJson.fromJsonMapper = object: FromJsonMapper {
            override fun <T> map(json: String, targetClass: Class<T>) =
                    gson.fromJson(json, targetClass)
        }

        JavalinJson.toJsonMapper = object: ToJsonMapper {
            override fun map(obj: Any): String = gson.toJson(obj)
        }
    }
}