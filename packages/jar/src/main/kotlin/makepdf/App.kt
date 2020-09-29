package makepdf

import com.github.kklisura.cdt.launch.ChromeLauncher
import kotlinx.cli.ArgParser
import kotlinx.cli.ArgType
import kotlinx.cli.required
import makepdf.server.Server
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths
import kotlin.streams.toList

object App {
    val isJar = App::class.java.getResource("App.class").toString().startsWith("jar:")
    val root: File = if (isJar) {
        File(App::class.java.protectionDomain.codeSource.location.toURI()).parentFile
    } else {
        File(System.getProperty("user.dir"))
    }

    val userRoot get(): String = Paths
        .get(root.path, rawUserRoot)
        .normalize()
        .toString()

    private var rawUserRoot = "../../in".replace("/", File.separator)

    val launcher = ChromeLauncher()
    val browser = launcher.launch(true)

    @JvmStatic
    fun main(args: Array<String>) {
        if (isJar) {
            cli(args)
        } else {
            makePdf(System.getenv("IN"))
        }
    }

    private fun cli(args: Array<String>) {
        val parser = ArgParser("makepdf")
        val input by parser.option(
                ArgType.String,
                description = "Input folder with markdown files"
        ).required()

        parser.parse(args)

        makePdf(input)
    }

    private fun makePdf(folder: String?) {
        folder?.let { rawUserRoot = folder }
        Server.run()

        val tab = browser.createTab()
        val devTools = browser.createDevToolsService(tab)

        val page = devTools.page
        val dom = devTools.dom

        devTools.css.enable()
        page.enable()
        dom.enable()

        page.onLoadEventFired {
            dom.outerHTML
        }

        val root = File(App.userRoot).toPath()
        Files.walk(root).filter { p ->
            Files.isRegularFile(p) && p.toFile().extension == "md"
        }.map {
            val f = it.relativize(root).toString().replace(File.separator, "/")

            page.navigate("http://localhost:${Server.apiServer.port()}/file/${f}")
        }

        devTools.waitUntilClosed()
        browser.closeTab(page)
        Server.stop()
    }
}
