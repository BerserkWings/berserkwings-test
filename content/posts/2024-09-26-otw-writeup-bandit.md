---
title: "Bandit - Over The Wire"
date: 2024-09-26
draft: false
slug: "otw-writeup-bandit"
excerpt: "Lo que haremos en esta ocasión, será resolver todos los niveles que se encuentran en la sección **Bandit**, esto como práctica de pentesting en entornos Linux."
categories: ["OverTheWire", "Bandit"]
tags: ["Linux", "Comandos Linux"]
tools: []
links:
  - "https://overthewire.org/wargames/bandit/"
  - "https://www.webservertalk.com/dashed-filename"
  - "https://itsfoss.com/es/comando-find-linux/#buscar-varios-archivos-con-varias-extensiones-o-condici%C3%B3n"
  - "https://www.hostinger.mx/tutoriales/como-usar-comando-find-locate-en-linux/#Busqueda_por_tipo"
  - "https://gospelidea.com/blog/que-son-los-permisos-chmod"
  - "https://www.ionos.mx/digitalguide/servidores/configuracion/comando-linux-find/"
  - "https://geekland.eu/uso-del-comando-grep-en-linux-y-unix-con-ejemplos/"
showtoc: true
header:
  teaser: "/assets/images/otw-writeups/overthewire-logo.jpg"
---

## Nivel 0 a 1 {#Nivel0}

**INSTRUCCIONES**:

El objetivo de este nivel es que inicies sesión en el juego conectandote al **servicio SSH** que tienen activo. El host al que debes conectarte es **bandit.labs.overthewire.org**, en el **puerto 2220**. El nombre de usuario es **bandit0** y la contraseña es **bandit0** (esto mismo te lo menciona la descripción del nivel). Una vez que hayas iniciado sesión, ve a la página del siguiente nivel (Nivel 0 a Nivel 1) para averiguar cómo entrar al Nivel 1.

La contraseña para el siguiente nivel se almacena en un archivo llamado **readme** ubicado en el directorio de inicio del nivel 0. Usa esta contraseña para iniciar sesión en **bandit1** usando **SSH**. 

Siempre que encuentres una contraseña para un nivel, usa el **servicio SSH** (en el **puerto 2220**) para iniciar sesión en ese nivel y continuar el juego.

---------

### Descripción de Comandos Usados {#Exp0}

Estos son los comandos que usamos en este nivel:

#### Comando ssh {#ssh}

| **Comando ssh** |
|:-----------:|
| *Se utiliza para establecer conexiones remotas seguras entre dos computadoras a través de una red. Permite a los usuarios acceder y administrar remotamente otro sistema como si estuvieran trabajando localmente en él.* |

Forma de uso:
```bash
ssh usuario@dirección_ip_o_hostname
```

Ejemplos:
* Conectandose al **servicio SSH**:
```bash
ssh berserk@10.10.10.10
```

* Especificando un puerto:
```bash
ssh berserk@10.10.10.10 -p 22
```

#### Comando whoami {#whoami}

| **Comando whoami** |
|:-----------:|
| *Se utiliza para mostrar el nombre del usuario actual con el que se ha iniciado sesión en el sistema. Es una combinación de las palabras "who am I" (¿quién soy?), y es útil para confirmar la identidad del usuario en la sesión actual, especialmente cuando se manejan múltiples cuentas o se cambia de usuario con su o sudo.* |

Forma de uso:
```bash
whoami
usuario_actual
```

Ejemplos:
* Obteniendo el usuario actual:
```bash
whoami
root
```

#### Comando ls {#ls}

| **Comando ls** |
|:-----------:|
| *Se utiliza para listar el contenido de un directorio. Es uno de los comandos más básicos y comunes, y muestra los archivos y subdirectorios dentro del directorio en el que te encuentras o en el que especifiques.* |

Forma de uso:
```bash
ls
```

Ejemplos:
* Listando archivos y subdirectorios del directorio actual
```bash
ls
```

* Listando archivos y subdirectorios de un directorio anterior:
```bash
ls ../
```

* Listando archivos y subdirectorios de un directorio especifico:
```bash
ls /home
```

* Listando archivos y subdirectorios del directorio actual, incluyendo los ocultos
```bash
ls -a
```

* Listando archivos y subdirectorios del directorio, incluyendo los permisos, fecha y hora de creación para cada uno de estos:
```bash
ls -l
```

#### Comando cat {#cat}

| **Comando cat** |
|:-----------:|
| *Se utiliza para concatenar y mostrar el contenido de archivos en la terminal. Es muy versátil y comúnmente se emplea para leer rápidamente el contenido de archivos de texto.* |

Formas de uso:
```bash
cat archivo_a_leer
```

Ejemplos:
* Leyendo un archivo:
```bash
cat archivo.txt
```

**Continuamos con la solución.**

### Solución {#Sol0}

Primero entremos al **servicio SSH**:
```bash
ssh bandit0@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit0@bandit.labs.overthewire.org's password:
```
Recuerda que la contraseña es **bandit0**

Es muy simple, la flag la encuentras solamente usando el comando **ls**:
```bash
bandit0@bandit:~$ whoami
bandit0
bandit0@bandit:~$ ls
readme
```

Y ya solo debes leer ese archivo:
```bash
bandit0@bandit:~$ cat readme
...
```
¡Listo! Ya tenemos la contraseña para el nivel 1. Para salir, solo usa el comando **exit**. Vayamos al siguiente nivel.

## Nivel 1 a 2 {#Nivel1}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en un archivo llamado **-** ubicado en el directorio de inicio.

----------------

### Descripción de Comandos {#Exp1}

#### Comando pwd {#pwd}

| **Comando pwd** |
|:-----------:|
| *Muestra la ruta completa del directorio de trabajo actual, es decir, el directorio en el que te encuentras en ese momento en la terminal. El comando pwd es útil para verificar tu ubicación en el sistema de archivos, especialmente cuando navegas entre múltiples directorios.* |

Forma de uso:
```bash
pwd
```

Ejemplos:
* Mostrando directorio actual:
```bash
pwd
/home/berserk/Desktop
```

#### Sustitución de Comandos {#sustitucion}

| **Sustitución de Comandos** |
|:-----------:|
| *La sintaxis $() en Bash se utiliza para ejecutar un comando y capturar su salida. El resultado del comando que se ejecuta dentro de $() se reemplaza en línea por la salida de ese comando.* |

Forma de uso:
```bash
Comando $(comando_A_usar)
```

Ejemplos:
* Usando un comando dentro de un **string** de **echo**:
```bash
echo "Estoy en: $(pwd)"
Estoy en: /home/berserk/Desktop
```

**Continuamos con la solución.**

### Solución {#Sol1}

Primero entremos al **servicio SSH**:
```bash
ssh bandit1@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit1@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 0**.

Ya nos indicaron donde se encuentra la contraseña para el siguiente nivel.

El problema es qué el nombre del archivo es un simple guion y si intentamos leerlo, nos dará un error:
```bash
bandit1@bandit:~$ whoami
bandit1
bandit1@bandit:~$ ls
-
bandit1@bandit:~$ cat -
^C
```

Ni me saco un error, por eso tuve que cancelar la acción. Para resolver esto, **Over The Wire** nos da una página con una solución:
* <a href="https://www.webservertalk.com/dashed-filename" target="_blank">Dashed Filename – Learn How to Create, Remove, List, Read & Copy!</a>

En resumen, para leer el archivo, simplemente usamos el siguiente signo **<**. 

Intentémoslo:
```bash
bandit1@bandit:~$ cat < -
...
```
¡Muy bien! Ya tenemos la contraseña para el siguiente nivel. 

Antes de ir a otro nivel, hay otras formas para poder ver esta clase de archivos, te las mostrare a continuación:

* Leer el archivo usando el **PATH**:
```bash
bandit1@bandit:~$ cat /home/bandit1/-
...
```

* Utilizar otros caracteres para leerlo
```bash
bandit1@bandit:~$ cat ./-
...
```

* Usando el comando **pwd**:
```bash
bandit1@bandit:~$ cat $(pwd)/-
...
```

Ahora si ya terminamos, sal y entra al siguiente nivel.

## Nivel 2 a 3 {#Nivel2}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en un archivo llamado **spaces**, ubicado en el directorio de inicio.

----------------

### Solución {#Sol2}

Primero entremos al **servicio SSH**:
```bash
ssh bandit2@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit2@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 1**.

Ya sabemos que hay un archivo llamado **spaces** que tiene la contraseña. 

Vamos a verlo:
```bash
bandit2@bandit:~$ whoami
bandit2
bandit2@bandit:~$ ls
spaces in this filename
```

Para leerlo, simplemente escribe las primeras letras del nombre del archivo y oprime la tecla **TAB** para que automáticamente te rellene el nombre del archivo:
```bash
bandit2@bandit:~$ cat spaces

bandit2@bandit:~$ cat spaces\ in\ this\ filename
...
```

Hay otras formas de poder leerlo, veamos cuales son:

* Leyendo todos los archivos que empiecen por **s**:
```bash
bandit2@bandit:~$ cat s*
...
```

* Usando el **PATH** para leer todos los archivos que empiecen en **s**:
```bash
bandit2@bandit:~$ cat /home/bandit2/s*
...
```

* Leyendo todos los archivos dentro de un **PATH**:
```bash
bandit2@bandit:~$ cat /home/bandit2/*
...
```

* Usando el comando **pwd**:
```bash
bandit2@bandit:~$ cat $(pwd)/*
...
```

¡Excelente! Ya tenemos la contraseña del siguiente nivel, sal y entra en el que sigue.

## Nivel 3 a 4 {#Nivel3}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en un archivo oculto en el directorio **inhere**.

----------------

### Descripción de Comandos {#Exp3}

#### Comando cd {#cd}

| **Comando cd** |
|:-----------:|
| *Se utiliza para cambiar el directorio de trabajo actual en la terminal. Es la abreviatura de "change directory".* |

Formas de uso:
```bash
cd nombre_directorio
```

Ejemplos:
* Moviendonos al un directorio **/home**:
```bash
cd
```

* Moviendonos a un directorio anterior:
```bash
cd ../
```

* Moviendonos a el directorio raiz:
```bash
cd /
```

* Moviendonos a un directorio especifico:
```bash
cd /home/Usuario/Desktop
```

#### Comando find {#find}

| **Comando find** |
|:-----------:|
| *Se utiliza para buscar archivos y directorios dentro de un sistema de archivos, según criterios específicos como nombre, tipo, fecha de modificación, tamaño, entre otros.* |

Formas de uso: 
```bash
find nombre_archivo_a_buscar
```

Ejemplos:
* Buscando un archivo en el directorio actual:
```bash
find archivo.txt
```

* Buscar un archivo entre todos los archivos del directorio actual:
```bash
find .
```

* Buscar un archivo en todo el sistema:
```bash
find /
```

* Buscando un archivo dentro de un directorio especifico y especificando su nombre:
```bash
find /home/usuario/Desktop --name "archivo.txt"
```

* Buscando un archivo de acuerdo a su tipo:
```bash
find . -type f -> archivo normal
find . -type d -> directorio
```

* Buscando un archivo por sus permisos:
```bash
find . -perm 666 
```

* Buscando un archivo por su tamaño:
```bash
find . -size 1500c -> bytes
find . -size 1500k -> kilobytes
find . -size 1500M -> megabytes
find . -size 1500G -> gigabytes
```

#### Comando grep {#grep}

| **Comando grep** |
|:-----------:|
| *Se utiliza para buscar patrones específicos de texto dentro de archivos o en la salida de otros comandos. Es ideal para encontrar líneas que contienen ciertas palabras o expresiones regulares.* |

Formas de uso: 
```bash
grep parametros
```

Ejemplos:
* Buscando una palabra dentro de un archivo:
```bash
grep "Hola" archivo.txt
```

* Buscando una cadena de texto dentro de un archivo:
```bash
grep -F "Cadena de texto a buscar" archivo.txt
```

* Mostrando el número de linea/s en donde se encuentra una cadena de texto o una palabra:
```bash
grep -n "Cadena de texto a buscar" archivo.txt
```

* Buscando una palabra sin importar que sea con mayusculas o minusculas:
```bash
grep -i "hola" archivo.txt
```

#### Comando xargs {#xargs}

| **Comando xargs** |
|:-----------:|
| *Se utiliza para construir y ejecutar comandos a partir de la salida de otros comandos. Toma la salida de un comando (normalmente una lista de elementos) y la usa como argumentos para otro comando.* |

Formas de uso: 
```bash
find archivo.txt | xargs comando
```

Ejemplos:
* Leyendo un archivo que se encontro con el comando **find**:
```bash
find . -type f | xargs cat
```

* Eliminando un archivo encontrado con el comando **find**:
```bash
find . --name "*.tmp" | xargs rm
```

#### Tuberias - Pipes {#tuberias}

| **Tuberías - Pipes** |
|:-----------:|
| *Representadas por el símbolo "\|", se utilizan para conectar la salida de un comando directamente como entrada para otro comando. Esto permite encadenar varios comandos de manera eficiente y procesar datos en una secuencia.* |

Formas de uso: 
```bash
comando | comando
```

Ejemplos:
* Imprimiendo contenido de un archivo y buscando una palabra:
```bash
cat archivo.txt | grep "contraseña"
```

**Continuamos con la solución.**

### Solución {#Sol3}

Primero entremos al **servicio SSH**:
```bash
ssh bandit3@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit3@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 2**.

Es muy sencillo, primero veamos qué hay:
```bash
bandit3@bandit:~$ whoami
bandit3
bandit3@bandit:~$ ls
inhere
bandit3@bandit:~$ cd inhere/
```

Entonces, el archivo que tiene la contraseña está almacenado en un archivo oculto, para verlo, agregamos los parámetros **-la** al comando **ls**:
```bash
bandit3@bandit:~/inhere$ ls -la
total 12
drwxr-xr-x 2 root    root    4096 Apr 23 18:04 .
drwxr-xr-x 3 root    root    4096 Apr 23 18:04 ..
-rw-r----- 1 bandit4 bandit3   33 Apr 23 18:04 .hidden
```

Y ya solo vemos el archivo con **cat**:
```bash
bandit3@bandit:~/inhere$ cat .hidden
...
```

En este punto, podemos jugar un poco con los comandos que nos muestra el nivel:

* Usando **find y xargs** para imprimir el contenido de los archivos en el directorio actual:
```bash
find . -type f | xargs cat
```

* Buscando e imprimiendo un archivo que tenga el nombre **"hidden"**:
```bash
find . -type f | grep "hidden" | xargs cat
```

¡Listo! Ya tenemos la contraseña para el siguiente nivel, sal y entra en el siguiente.

## Nivel 4 a 5 {#Nivel4}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en el único archivo legible por humanos en el directorio **inhere**. Consejo: si su terminal está desordenada, intente con el comando **"reset"**.

----------------

### Descripción de Comandos {#Exp4}

#### Comando file {#file}

| **Comando file** |
|:-----------:|
| *Se utiliza para determinar el tipo de archivo de uno o más archivos especificados. En lugar de basarse únicamente en la extensión del archivo, file analiza el contenido del archivo para identificar su tipo.* |

Formas de uso:
```bash
fiel archivo
```

Ejemplos:
* Mostrando que tipo de archivo es un archivo elegido:
```bash
file archivo.txt
archivo.txt: ASCII text
```

**Continuamos con la solución.**

### Solución {#Sol4}

Primero entremos al **servicio SSH**:
```bash
ssh bandit4@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit4@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 3**.

Nos dice que la contraseña, está en una archivo que solo lo pueden leer los humanos...bueno, veamos qué hay dentro:
```bash
bandit4@bandit:~$ ls
inhere
bandit4@bandit:~$ cd inhere/
bandit4@bandit:~/inhere$ ls -la
total 48
drwxr-xr-x 2 root    root    4096 Apr 23 18:04 .
drwxr-xr-x 3 root    root    4096 Apr 23 18:04 ..
-rw-r----- 1 bandit5 bandit4   33 Apr 23 18:04 -file00
-rw-r----- 1 bandit5 bandit4   33 Apr 23 18:04 -file01
-rw-r----- 1 bandit5 bandit4   33 Apr 23 18:04 -file02
-rw-r----- 1 bandit5 bandit4   33 Apr 23 18:04 -file03
-rw-r----- 1 bandit5 bandit4   33 Apr 23 18:04 -file04
-rw-r----- 1 bandit5 bandit4   33 Apr 23 18:04 -file05
-rw-r----- 1 bandit5 bandit4   33 Apr 23 18:04 -file06
-rw-r----- 1 bandit5 bandit4   33 Apr 23 18:04 -file07
-rw-r----- 1 bandit5 bandit4   33 Apr 23 18:04 -file08
-rw-r----- 1 bandit5 bandit4   33 Apr 23 18:04 -file09
```

Mmmmm, los permisos indican que no se pueden ni leer con **cat**, a menos que los ejecutemos como programas. 

Entonces, veamos qué tipo de archivos son con el comando **file**:
```bash
bandit4@bandit:~/inhere$ file ./-file*
./-file00: data
./-file01: data
./-file02: data
./-file03: data
./-file04: data
./-file05: data
./-file06: data
./-file07: ASCII text
./-file08: data
./-file09: Non-ISO extended-ASCII text, with no line terminators
```

También pudimos hacerlo combinando varios comandos como el comando **find, grep y xargs**:
```bash
bandit4@bandit:~/inhere$ find . -type f | grep "\-file" | xargs file
./-file08: data
./-file02: data
./-file09: data
./-file01: data
./-file00: data
./-file05: data
./-file07: ASCII text
./-file03: data
./-file06: data
./-file04: data
```

Solamente hay un archivo que es de texto, vamos a verlo:
```bash
bandit4@bandit:~/inhere$ cat ./-file07
...
```
¡Excelente! Ya tenemos la contraseña, sal y entra al siguiente.

## Nivel 5 a 6 {#Nivel5}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel, se almacena en un archivo en algún lugar del directorio **inhere** y tiene todas las siguientes propiedades:
* legible por humanos
* 1033 bytes de tamaño
* no ejecutable

----------------

### Descripción de Comandos {#Exp5}

#### Comando head {#head}

| **Comando head** |
|:-----------:|
| *El comando head en Linux se utiliza para mostrar las primeras líneas de un archivo o la salida de otro comando. Por defecto, head muestra las primeras 10 líneas de un archivo de texto, pero puedes modificar esta cantidad utilizando opciones adicionales.* |

Formas de uso:
```bash
head [opciones] [archivo]
```

Ejemplos:
* Mostrando las primeras 10 lineas de un archivo:
```bash
head archivo.txt
```

* Mostrando las primeras 5 lineas de un archivo:
```bash
cat archivo.txt | head -n 5
```

* Mostrando la primera linea de un archivo:
```bash
grep "archivo1.txt" | xargs cat | head -n 1
```

* Mostrando los primeros 100 bytes de un archivo:
```bash
head -c 100 archivo.txt
```

**Continuamos con la solución.**

### Solución {#Sol5}

Primero entremos al **servicio SSH**:
```bash
ssh bandit5@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit5@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 4**.

Hay varias condiciones que tiene el archivo que contiene la contraseña, para buscarlo, usaremos el comando **find** con varios argumentos. 

Te comparto unos links con ejemplos de como usar el comando **find** y sobre los permisos de archivos:
* <a href="https://itsfoss.com/es/comando-find-linux/#buscar-varios-archivos-con-varias-extensiones-o-condici%C3%B3n" target="_blank">15 ejemplos súper útiles del comando Find en Linux</a>
* <a href="https://www.hostinger.mx/tutoriales/como-usar-comando-find-locate-en-linux/#Busqueda_por_tipo" target="_blank">Cómo usar los comandos find y locate en Linux</a>
* <a href="https://gospelidea.com/blog/que-son-los-permisos-chmod" target="_blank">¿Qué son los permisos CHMOD en Linux?</a>

Bien, ahora entremos:
```bash
bandit5@bandit:~$ ls
inhere
bandit5@bandit:~$ cd inhere/
bandit5@bandit:~/inhere$ ls -la
total 88
drwxr-x--- 22 root bandit5 4096 Apr 23 18:04 .
drwxr-xr-x  3 root root    4096 Apr 23 18:04 ..
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere00
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere01
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere02
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere03
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere04
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere05
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere06
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere07
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere08
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere09
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere10
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere11
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere12
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere13
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere14
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere15
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere16
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere17
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere18
drwxr-x---  2 root bandit5 4096 Apr 23 18:04 maybehere19
```

Demasiados directorios, prodríamos buscar nuestro archivo, pero eso no es óptimo, así que usemos el comando **find**. 

Le agregaremos los siguientes parámetros:
* *-type f*: Para que busque archivos.
* *-size 1033c*: Para que busque los archivos con **1033 bytes** de tamaño. 
* *-perm 640*: Para que busque por archivos con permisos de no ejecución.
* *grep ASCII*: Para que con **grep**, busque archivos que sean legibles por humanos.

Quedaría así:
```bash
bandit5@bandit:~/inhere$ find . -type f -size 1033c -perm 640 | grep ASCII
./maybehere07/.file2
```

Ahora, veamos el contenido de ese archivo:
```bash
cat maybehere07/.file2
...
```

También podiamos obtener el resultado de manera directa:
```bash
bandit5@bandit:~/inhere$ find . -type f ! -executable -size 1033c | xargs cat | head -n 1
```

¡Listo! Ya tenemos la contraseña, sal y entra al siguiente.

## Nivel 6 a 7 {#Nivel6}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en algún lugar del servidor y tiene todas las siguientes propiedades:
* propiedad del usuario bandit7
* propiedad del grupo bandit6
* 33 bytes de tamaño

----------------

### Solución {#Sol6}

Primero entremos al **servicio SSH**:
```bash
ssh bandit6@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit6@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 5**.

Hay varias condiciones, igual usaremos el comando **find** y usemos las mismas páginas de referencia que puse en el nivel anterior para guiarnos. 

Aunque me sirvió más esta página:
* <a href="https://www.ionos.mx/digitalguide/servidores/configuracion/comando-linux-find/" target="_blank">Linux find comando</a>

Veamos que hay dentro:
```bash
bandit6@bandit:~$ ls
bandit6@bandit:~$ ls -la
total 20
drwxr-xr-x  2 root root 4096 Apr 23 18:04 .
drwxr-xr-x 70 root root 4096 Apr 23 18:05 ..
-rw-r--r--  1 root root  220 Jan  6  2022 .bash_logout
-rw-r--r--  1 root root 3771 Jan  6  2022 .bashrc
-rw-r--r--  1 root root  807 Jan  6  2022 .profile
```

No hay nada, entonces vamos a buscar en todo el servidor como nos mencionan, usemos el comando **find**. Para buscar en todo el servidor, usamos un **/** en vez de un **.** :
```bash
bandit6@bandit:~$ find / -type f -user bandit7 -group bandit6 -size 33c
find: ‘/var/log’: Permission denied
find: ‘/var/crash’: Permission denied
find: ‘/var/spool/rsyslog’: Permission denied
find: ‘/var/spool/bandit24’: Permission denied
find: ‘/var/spool/cron/crontabs’: Permission denied
...
```

Salieron muchos, entonces vamos a redirigir los errores al **/dev/null** para que solo nos muestre los resultados correctos:
```bash
bandit6@bandit:~$ find / -type f -user bandit7 -group bandit6 -size 33c 2>/dev/null
/var/lib/dpkg/info/bandit7.password
```

Ahora veamos el contenido de ese archivo:
```bash
bandit6@bandit:~$ cat /var/lib/dpkg/info/bandit7.password
...
```
¡Listo! Ya tenemos la contraseña, sal y entra al siguiente.

## Nivel 7 a 8 {#Nivel7}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en el archivo **data.txt** junto a la palabra **millionth**.

----------------

### Descripción de Comandos {#Exp7}

#### Comando awk {#awk}

| **Comando awk** |
|:-----------:|
| *awk es un potente lenguaje de procesamiento de texto y un comando en Linux que se utiliza para manipular y extraer datos de archivos o entradas de texto. Se especializa en procesar texto estructurado en columnas o campos separados por delimitadores (como espacios o comas).* |

Formas de uso:
```bash
awk 'patron {accion_a_realizar} archivo'
```

Ejemplos:
* Mostrando la segunda columna **($2)** de un archivo:
```bash
awk '{print $2}' archivo.txt
```

* Utilizando un delimitador distinto (una coma):
```bash
awk -F',' '{print $1, $3}' archivo.csv
```

#### Comando cut {#cut}

| **Comando cut** |
|:-----------:|
| *cut es una herramienta más simple que se utiliza para extraer partes de líneas de texto en función de posiciones de caracteres, bytes o delimitadores. Es útil cuando necesitas extraer columnas específicas o secciones de texto de un archivo.* |

Formas de uso:
```bash
cut [opciones] archivo
```

Ejemplos:
* Extrayendo la segunda columna de un archivo delimitado por tabulaciones:
```bash
cut -f 2 archivo.txt
```

* Extrayendo la primera y tercera columna de un archivo delimitado por comas:
```bash
cut -d ',' -f 1,3 archivo.csv
```

#### Comando rev {#rev}

| **Comando rev** |
|:-----------:|
| *El comando rev en Linux se utiliza para invertir el orden de los caracteres en cada línea de un archivo o entrada de texto. Es una herramienta muy sencilla y directa.* |

Formas de uso:
```bash
rev [archivo]
```

Ejemplos:
* Invirtiendo el contenido de un **string**:
```bash
echo "Hola mundo" | rev
```

* Invirtiendo la lineas de un archivo
```bash
rev archivo.txt
```

#### Comando tr {#tr}

| **Comando tr** |
|:-----------:|
| *El comando tr (translate) se utiliza para traducir, reemplazar o eliminar caracteres de un flujo de texto. Es muy útil para operaciones simples de sustitución de caracteres o eliminación de espacios y saltos de línea.* |

Formas de uso:
```bash
tr [opciones] set1 [set2]
```

Ejemplos:
* Convirtiendo minúsculas a mayúsculas:
```bash
echo "hola mundo" | tr 'a-z' 'A-Z'
```

* Eliminando espacios en blanco:
```bash
echo "Hola   Mun do" | tr -d ' '
```

* Reemplazando espacios por guiones:
```bash
echo "Hola Mundo" | tr ' ' '-'
```

* Comprimiendo multiples espacios en uno solo:
```bash
echo "Hola      Mundo" | tr -s ' '
```

#### Comando tail {#tail}

| **Comando tail** |
|:-----------:|
| *El comando tail en Linux se utiliza para mostrar las últimas líneas de un archivo o la salida de otro comando. Por defecto, muestra las últimas 10 líneas, pero puedes modificar este comportamiento con diferentes opciones.* |

Formas de uso:
```bash
tail [opciones[ [archivo]
```

Ejemplos:
* Mostrando las 10 últimas lineas de un archivo:
```bash
tail archivo.txt
```

* Mostrando las 20 últimas lineas de un archivo:
```bash
tail -n 20 archivo.txt
```

* Mostrando los últimos 100 bytes de una archivo:
```bash
tail -c 100 archivo.txt
```

**Continuamos con la solución.**

### Solución {#Sol7}

Primero entremos al **servicio SSH**:
```bash
ssh bandit7@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit7@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 6**.

Como nos dice, hay un archivo llamado **data.txt** y la contraseña se encuentra junto a la palabra **millionth**, para encontrar esa palabra usaremos el comando **grep**, aquí te dejo este link con información muy útil sobre **grep**:
* <a href="https://geekland.eu/uso-del-comando-grep-en-linux-y-unix-con-ejemplos/" target="_blank">Uso del comando grep en Linux y UNIX con ejemplos</a>

Veamos que contiene ese archivo:
```bash
bandit7@bandit:~$ ls
data.txt
bandit7@bandit:~$ cat data.txt 
Worcester's     fyKdWWh7VVgusiIKPygHJe6TlkDHhLHl
arousal r8mfBurE2OvHu8NFQc7mJ2x14iNjwkin
counterespionage's      4jmzYqFkqwciprPrJleFCI9tyjbXBtdt
Willard's       ctbhPNPRDGAll4Whhsrz3Mwv6qJHM8Et
midwife Kk9VZkoTUNUfmIa031vovUN2UKksZ56S
...
```

El archivo tiene mucho texto, ahora usemos **grep** de tal forma que busque la palabra **"millionth"** de manera exacta (usaremos el parámetro **-w** para eso y complementamos con **-E**):
```bash
bandit7@bandit:~$ grep -E -w 'millionth' data.txt
millionth		...
```
Y ahí está. 

Vamos a complicarnos un poquito para utilizar otros comandos que nos pueden servir más adelante.

Utilicemos el **comando awk** para encontrar y obtener directamente la contraseña.

Te dejo estos links de apoyo:
* <a href="https://www.shortcutfoo.com/app/dojos/awk/cheatsheet" target="_blank">AWK Cheatsheet</a>
* <a href="https://bl831.als.lbl.gov/~gmeigs/scripting_help/awk_cheat_sheet.pdf" target="_blank">AWK cheat sheets</a>

Probemos:
* Extrayendo el último campo de cada linea del archivo con **awk**:
```bash
bandit7@bandit:~$ cat data.txt | grep "millionth" | awk 'NF{print $NF}'
...
```

* Obteniendo la segunda columna con **awk**
```bash
bandit7@bandit:~$ cat data.txt | grep "millionth" | awk '{print $2}'
...
```

Ahora probemos con el **comando cut**:

* Extrayendo la segunda columna y eliminando espacios con **cut**:
```bash
cat data.txt | grep "millionth" | cut -d ' ' -f 2
...
```

Combinación con el **comando rev y awk**:
```bash
bandit7@bandit:~$ cat data.txt | grep "millionth" | rev | awk '{print $1}' | rev
...
```

Obteniendo contraseña en combinación con el **comando tr y tail**:
```bash
bandit7@bandit:~$ cat data.txt | grep "millionth" | xargs | tr ' ' '\n' | tail -n 1
...
```

Ya tenemos la contraseña, sal y entra al siguiente.

## Nivel 8 a 9 {#Nivel8}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en el archivo **data.txt** y es la única línea de texto que aparece una sola vez.

----------------

### Descripción de Comandos {#Exp8}

#### Comando sort {#sort}

| **Comando sort** |
|:-----------:|
| *Se utiliza para ordenar las líneas de texto de un archivo o la entrada estándar. Puede ordenar alfabéticamente, numéricamente, y en orden ascendente o descendente, entre otras opciones.* |

Formas de uso:
```bash
sort archivo.txt
```

Ejemplos:
* Ordenando un archivo:
```bash
sort archivo.txt
```

* Ordenando el contenido de un archivo de manera inversa:
```bash
sort -r archivo.txt
```

* Ordenando y eliminando palabras duplicados:
```bash
sort -u archivo.txt > archivo_sin_duplicados.txt
```

#### Comando uniq {#uniq}

| **Comando uniq** |
|:-----------:|
| *Se utiliza para filtrar líneas repetidas consecutivas en un archivo o entrada estándar. Generalmente se combina con sort para eliminar duplicados no consecutivos.* |

Formas de uso:
```bash
sort archivo.txt | unique
```

Ejemplos:
* Mostrando lineas unicas dentro de un archivo:
```bash
sort archivo.txt | unique
```

* Mostrando lineas que aparecen solamente una vez dentro de un archivo:
```bash
sort archivo.txt | unique -u
```

* Mostrando lineas que aparecen al menos 2 veces dentro de un archivo:
```bash
sort archivo.txt | unique -d
```

**Continuamos con la solución.**

### Solución {#Sol8}

Primero entremos al **servicio SSH**:
```bash
ssh bandit8@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit8@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 7**.

Hay que buscar una línea de texto que sea única de todas las que hay en el archivo **data.txt**, para esto, usaremos los comandos **sort** y **uniq**.

Primero, veamos el contenido:
```bash
bandit8@bandit:~$ ls
data.txt
bandit8@bandit:~$ cat data.txt 
QWiiBJhqUoMj0lCD9XNrkTM1M94eIPMV
UkKkkIJoUVJG6Zd1TDfEkBdPJptq2Sn7
ITQY9WLlsn3q168qH29wYMLQjgPH9lNP
JddNHIO2SAqKPHrrCcL7yTzArusoNwrt
0dEKX1sDwYtc4vyjrKpGu30ecWBsDDa9
...
```

El contenido del archivo es demasiado, ahora usemos los comandos:
```bash
bandit8@bandit:~$ sort data.txt | uniq -u
...
```

¡Exacto! Ya tenemos la contraseña, sal y entra al siguiente.

## Nivel 9 a 10 {#Nivel9}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en el archivo **data.txt**, en una de las pocas cadenas legibles por humanos, precedida por varios caracteres **'='**.

----------------

### Descripción de Comandos {#Exp9}

#### Comando strings {#strings}

| **Comando strings** |
|:-----------:|
| *Se utiliza para extraer y mostrar las cadenas de texto legible (ASCII o Unicode) que se encuentran dentro de archivos binarios o cualquier archivo no textual. Es útil para inspeccionar archivos binarios, como ejecutables, en busca de contenido de texto que pueda ser relevante.* |

Formas de uso:
```bash
strings archivo.txt
```

Ejemplos:
* Mostrando las cadenas legibles de un archivo:
```bash
strings archivo.bin
```

**Continuamos con la solución.**

### Solución {#Sol9}

Primero entremos al **servicio SSH**:
```bash
ssh bandit8@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit8@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 8**.

Tendremos que ver los permisos del archivo y que contenga más de un signo **=**. El problema es que el archivo está compuesto de solo data:
```bash
bandit9@bandit:~$ file data.txt 
data.txt: data
```
Lo que tendremos que hacer, será convertir la data a strings, para que sea un texto legible y luego buscar la línea de texto que tenga más de 2 signos **"=="**.

Hagámoslo:
```bash
strings data.txt | grep "==="
4========== the#
========== password
========== is
========== *****
```
¡Exacto! Ya tenemos la contraseña, sal y entra al siguiente.

## Nivel 10 a 11 {#Nivel10}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en el archivo data.txt, que contiene datos codificados en base64.

----------------

### Descripción de Comandos {#Exp10}

#### Comando base64 {#base64}

| **Comando base64** |
|:-----------:|
| *Se utiliza para codificar y decodificar datos en el esquema de codificación Base64, que convierte datos binarios en texto ASCII. Es comúnmente usado para transmitir datos binarios en formatos que solo admiten texto, como en correos electrónicos o URLs.* |

Formas de uso:
```bash
base64 archivo.txt > archivo_en_base64.txt
```

Ejemplos:
* Convirtiendo el contenido de un archivo a **base64**:
```bash
base64 archivo.txt > archivo_en_base64.txt
```

* Convirtiendo un texto en **base64**:
```bash
echo "Hola como estas?" | base64
```

* Decodificando un archivo en **base64** y un texto en **base64**:
```bash
base64 -d archivo_en_base64.txt > archivo.txt
echo "SG9sYSBjb21vIGVzdGFzPwo=" | base64 -d
```

**Continuamos con la solución.**

### Solución {#Sol10}

Primero entremos al **servicio SSH**:
```bash
ssh bandit10@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit10@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 9**.

Si bien el archivo está en **base64**, lo único que debemos hacer, será decodificar esa **base64**. Lo haremos con el comando **base64** y el parámetro **-d** que sirve para decodificar esa base:
```bash
bandit10@bandit:~$ ls
data.txt
bandit10@bandit:~$ file data.txt 
data.txt: ASCII text
bandit10@bandit:~$ cat data.txt 
VGhlIHBhc3N3b3JkIGlzIDZ6UGV6aUxkUjJSS05kTllGTmI2blZDS3pwaGxYSEJNCg==
```

Como puedes observar, el hash pareciera que es la contraseña, pero no es así.

Ahora, apliquemos el comando:
```bash
bandit10@bandit:~$ base64 -d data.txt 
The password is *****
```

¡Muy bien! Ya tenemos la contraseña, sal y entra al siguiente.

## Nivel 11 a 12 {#Nivel11}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en el archivo data.txt, donde todas las letras minúsculas (a-z) y mayúsculas (A-Z) se han rotado 13 posiciones.

----------------

### Solución {#Sol11}

Primero entremos al **servicio SSH**:
```bash
ssh bandit11@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit11@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 10**.

Para resolver esto, usaremos el comando **tr**.

Entonces, con **tr** vamos a mover todas las letras a donde estaban originalmente. Primero, veamos como quedaron las letras:
* Cada letra se movió 13 posiciones, es decir, la letra **a**, ya no es la **a** sino otra letra.
* Si miras el alfabeto, cuenta de la letra a 13 posiciones, debería quedar en la letra **m**. Debes contar desde A a Z, no te saltes la A.
* Esto es muy similar al cifrado de cesar, en el que se rotaban las letras, de acuerdo a una clave para que el mensaje quede encriptado.
* También se le conoce como ROT13.

Ahora sí, hagámoslo:
```bash
bandit11@bandit:~$ ls
data.txt
bandit11@bandit:~$ cat data.txt 
Gur cnffjbeq vf WIAOOSFzMjXXBC0KoSKBbJ8puQm5lIEi
bandit11@bandit:~$ file data.txt 
data.txt: ASCII text
bandit11@bandit:~$ tr 'A-Za-z' 'N-ZA-Mn-za-m' < data.txt 
The password is
```

Si te fijas, lo que hicimos fue sustituir **'A-Za-z'** por **'N-ZA-Mn-za-m'**, en donde:
* *A-Z = N-ZA-M*
* *a-z = n-za-m*

¡Muy bien! Ya tenemos la contraseña, sal y entra al siguiente.

## Nivel 12 a 13 {#Nivel12}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en el archivo data.txt, que es un **hexdump** de un archivo que ha sido comprimido repetidamente. Para este nivel puede ser útil crear un directorio bajo **/tmp** en el que puedas trabajar. Utilice **mkdir** con un nombre de directorio difícil de adivinar. O mejor, utilice el comando **"mktemp -d"**. Luego copia el archivo de datos usando **cp**, y renómbralo usando mv (¡lee las páginas de manual!)

----------------

### Descripción de Comandos {#Exp12}

#### Comando xxd {#xxd}

| **Comando xxd** |
|:-----------:|
| *El comando xxd en Linux se utiliza para crear un volcado hexadecimal de un archivo o de la entrada estándar. También se puede usar para convertir un volcado hexadecimal de vuelta a su formato binario original.* |

Formas de uso:
```bash
xxd [opciones] [archivo]
```

Ejemplo:
* Mostrando contenido de un archivo en formato hexadecimal:
```bash
xxd archivo.txt
```

* Creando un volcado hexadecimal de un archivo en formato simple (solo bytes):
```bash
xxd -p archivo.txt
```

* Convertir un volcado hexadecimal de vuelta a binario:
```bash
xxd -r archivo.txt > archivoBin
```

#### Comando 7z {#7z}

| **Comando 7z** |
|:-----------:| 
| *El comando 7z es parte de la utilidad 7-Zip, que se utiliza para comprimir y descomprimir archivos con múltiples formatos. Es muy eficiente para comprimir grandes archivos y puede manejar varios formatos, como 7z, zip, tar, gzip, entre otros.* |

Formas de uso: 
```bash
7z [opciones] archivo
```

Ejemplo:
* Comprimiendo un archivo o directorio en formato **7z**:
```bash
7z a archivo.7z archivo.txt
```

* Listando el contenido de un archivo comprimido:
```bash
7z l archivo.7z
```

* Descomprimiendo un archivo **7z**:
```bash
7z x archivo.7z
```

#### Comando gzip {#gzip}

| **Comando gzip** |
|:-----------:| 
| *El comando gzip se utiliza para comprimir archivos en Linux usando el algoritmo de compresión DEFLATE. El archivo original se reemplaza por uno con la extensión gz.* |

Formas de uso: 
```bash
gzip [opciones] [archivo]
```

Ejemplo:
* Comprimiendo un archivo:
```bash
gzip archivo.txt
```

* Descomprimiendo un archivo:
```bash
gzip -d archivo.gz
```

* Comprimiendo todos los archivos en un directorio de forma recursiva:
```bash
gzip -r /ruta/al/directorio
```

#### Comando bzip2 {#bzip2}

| **Comando bzip2** |
|:-----------:| 
| *El comando bzip2 se utiliza para comprimir archivos utilizando el algoritmo Burrows-Wheeler y la codificación Huffman. Los archivos comprimidos con bzip2 tienen la extensión bz2. Este comando suele generar archivos más pequeños que gzip, pero puede ser un poco más lento.* |

Formas de uso: 
```bash
bzip2 [opciones] [archivo]
```

Ejemplo:
* Comprimiendo un archivo:
```bash
bzip2 archivo.txt
```

* Descomprimiendo un archivo:
```bash
bzip2 -d archivo.bz2
```

* Comprimiendo un archivo sin eliminar el original:
```bash
bzip2 -k archivo.txt
```

#### Comando tar {#tar}

| **Comando tar** |
|:-----------:| 
| *El comando tar se utiliza para agrupar varios archivos y carpetas en un solo archivo, generalmente con la extensión tar. Aunque no comprime archivos por sí solo, es común utilizarlo junto con herramientas de compresión como gzip o bzip2 para crear archivos comprimidos .tar.gz o .tar.bz2.* | 

Formas de uso: 
```bash
tar [opciones] [archivo_tar] [archivos_o_directorios]
```

Ejemplo:
* Creando un archivo **tar** (sin comprimir):
```bash
tar -cvf archivo.tar archivo1.txt archivo2.txt
```

* Extrayendo un archivo **tar**:
```bash
tar -xvf archivo.tar
```

#### Comando sponge {#sponge}

| **Comando sponge** |
|:-----------:|
| *El comando sponge es parte de la colección moreutils y se utiliza para leer toda la entrada estándar y luego escribirla en un archivo, permitiendo que se sobrescriba el archivo de entrada. Lo que lo hace especial es que espera a leer completamente la entrada antes de escribir, lo cual evita problemas que ocurren cuando intentas sobrescribir un archivo mientras lo estás leyendo.* |

Formas de uso:
```bash
comando | sponge [archivo]
```

Ejemplo:
* Sobreescribiendo un archivo con contenido modificado:
```bash
sort archivo.txt | sponge archivo.txt
```

**Continuemos con la solución.**

### Solución {#Sol12}

Primero entremos al **servicio SSH**:
```bash
ssh bandit12@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit12@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 11**.

Esta parte es un poco tediosa, como dicen las instrucciones, tenememos un archivo que ha sido comprimido varias veces, por lo que debemos descomprimirlo varias veces hasta encontrar el archivo que contiene la contraseña.

Vamos a hacerlo de 2 maneras:
* La primera será utilizando los comandos **xxd, sponge y 7z**.
* La segunda será utilizando los comandos **xxd, gzip, b2zip, y tar**.

#### Primera Forma de Descompresión con 7z {#descompresion1}

Vamos a copiar el archivo en nuestra máquina, tan solo usa **cat** para ver el contenido del archivo y copialo en tu máquina.

Una vez copiado, vamos a convertir el archivo hexadecimal en un archivo binario y usamos **sponge** para evitar errores:
```bash
cat data.txt | xxd -r | sponge data
ls
data.txt data
```

Puedes analizar el archivo con el comando **file**, cambia su nombre para ponerle la **extensión gz**:
```bash
file data
data: gzip compressed data, was "data2.bin"...
mv data data.gz
```

También podemos listar el contenido de este archivo con **7z**:
```bash
7z l data.gz
Scanning the drive for archives:
1 file, 607 bytes (1 KiB)
*
Listing archive: data.gz
--
Path = data.gz
Type = gzip
Headers Size = 20
*
   Date      Time    Attr         Size   Compressed  Name
------------------- ----- ------------ ------------  ------------------------
2023-05-25 01:08:15 .....          574          607  data2.bin
------------------- ----- ------------ ------------  ------------------------
2023-05-25 01:08:15                574          607  1 files
```

Por último, solamente debemos descomprimir todos los archivos resultantes hasta obtener un archivo de texto, que lo identificaras porque es un archivo tipo **ASCII**, a continuación solamente pondre los archivos obtenidos y su descompresión:

* Primer descompresión:
```bash
7z x data.gz
Extracting archive: data.gz
--
Path = data.gz
Type = gzip
Headers Size = 20
Everything is Ok
Size:       574
Compressed: 607
*
file data2.bin
data2.bin: bzip2 compressed data, block size = 900k
```

* Segunda descompresión:
```bash
7z x data2.bin
Extracting archive: data2.bin
--
Path = data2.bin
Type = bzip2
Everything is Ok
Size:       432
Compressed: 574
*
file data2
data2: gzip compressed data, was "data4.bin"..
```

* Tercera descompresión:
```bash
7z x data2
Extracting archive: data2
--
Path = data2
Type = gzip
Headers Size = 20
Everything is Ok
Size:       20480
Compressed: 432
*
file data4.bin
data4.bin: POSIX tar archive (GNU)
```

* Cuarta descompresión:
```bash
7z x data4.bin
Extracting archive: data4.bin
--
Path = data4.bin
Type = tar
Physical Size = 20480
Headers Size = 10240
Code Page = UTF-8
Everything is Ok
Size:       10240
Compressed: 20480
*
file data5.bin
data5.bin: POSIX tar archive (GNU)
```

* Quinta descompresión:
```bash
7z x data5.bin
Extracting archive: data5.bin
--
Path = data5.bin
Type = tar
Physical Size = 10240
Headers Size = 9728
Code Page = UTF-8
Everything is Ok
Size:       221
Compressed: 10240
*
file data6.bin
data6.bin: bzip2 compressed data, block size = 900k
```

* Sexta descompresión:
```bash
7z x data6.bin
Extracting archive: data6.bin
--
Path = data6.bin
Type = bzip2
Everything is Ok
Size:       10240
Compressed: 221
*
file data6
data6: POSIX tar archive (GNU)
```

* Septima descompresión:
```bash
7z x data6
Extracting archive: data6
--
Path = data6
Type = tar
Physical Size = 10240
Headers Size = 9728
Code Page = UTF-8
Everything is Ok
Size:       79
Compressed: 10240
*
file data8.bin
data8.bin: gzip compressed data, was "data9.bin"...
```

* Octava descompresión:
```bash
7z x data8.bin
Extracting archive: data8.bin
--
Path = data8.bin
Type = gzip
Headers Size = 20
Everything is Ok
Size:       49
Compressed: 79
*
file data9.bin
data9.bin: ASCII text
```

Y listo, ya tenemos nuestro archivo, tan solo hay leerlo y tendremos la contraseña para el siguiente nivel:
```bash
cat data9.bin
...
```

#### Segunda Forma de Descompresión con gzip, bzip2 y tar {#descompresion2}

Ahora para la segunda forma es similar el proceso, pero vamos a usar los **comandos gzip, bzip2 y tar**.

Como dice las instrucciones, vamos a movernos al directorio **/tmp** y vamos a crear un directorio temporal con el **comando mktemp**:
```bash
bandit12@bandit:~$ cd /tmp
bandit12@bandit:/tmp$ mktemp -d
/tmp/tmp.nq7qMbq79D
bandit12@bandit:/tmp$ cd /tmp/tmp.nq7qMbq79D$
bandit12@bandit:/tmp/tmp.nq7qMbq79D$
```

Copiamos el archivo en nuestro directorio actual:
```bash
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ cp ~/data.txt .
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data.txt
```

Y convertimos el archivo que es hexadecimal a binario con el **comando xxd**:
```bash
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ cat data.txt | xxd -r > hexdata
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data.txt  hexdata
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ file hexdata 
hexdata: gzip compressed data, was "data2.bin"...
```

Con esto listo, vamos a empezar a descomprimir todos los archivos que vayan resultando, la diferencia a como lo hicimos antes es que debemos ir agregando las extensiones a cada archivo resultante y cada archivo se debe descomprimir con su debida herramienta.

Vamos a por ello:

* Primer descompresión:
```bash
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ mv hexdata hexdata.gz
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ gzip -d hexdata.gz
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data.txt  hexdata
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ file hexdata 
hexdata: bzip2 compressed data, block size = 900k
```

* Segunda descompresión:
```bash
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ mv hexdata hexdata.bz2
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data.txt  hexdata.bz2
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ bzip2 -d hexdata.bz2 
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data.txt  hexdata
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ file hexdata 
hexdata: gzip compressed data, was "data4.bin"
```

* Tercera descompresión:
```bash
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ mv hexdata hexdata.gz
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data.txt  hexdata.gz
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ gzip -d hexdata.gz 
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data.txt  hexdata
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ file hexdata 
hexdata: POSIX tar archive (GNU)
```

* Cuarta descompresión:
```bash
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ mv hexdata hexdata.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data.txt  hexdata.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ tar xf hexdata.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data5.bin  data.txt  hexdata.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ file data5.bin
data5.bin: POSIX tar archive (GNU)
```

* Quinta descompresión:
```bash
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ mv data5.bin data.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ tar xf data.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data6.bin  data.tar  data.txt  hexdata.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ file data6.bin
data6.bin: bzip2 compressed data, block size = 900k
```

* Sexta descompresión:
```bash
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ mv data6.bin data6.bz2
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data6.bz2  data.tar  data.txt  hexdata.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ bzip2 -d data6.bz2
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data6  data.tar  data.txt  hexdata.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ file data6
data6: POSIX tar archive (GNU)
```

* Septima descompresión:
```bash
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ mv data6 data6.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ tar xf data6.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data6.tar  data8.bin  data.tar  data.txt  hexdata.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ file data8.bin 
data8.bin: gzip compressed data, was "data9.bin"...
```

* Octavo descompresión:
```bash
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ mv data8.bin data8.gz
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ gzip -d data8.gz 
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ ls
data8  data6.tar  data.tar  data.txt  hexdata.tar
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ file data8
data8: ASCII text
```

Y listo, tenemos otra vez la contraseña:
```bash
bandit12@bandit:/tmp/tmp.nq7qMbq79D$ cat data8
The password is ...
```

## Nivel 13 a 14 {#Nivel13}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en **/etc/bandit_pass/bandit14** y sólo puede ser leída por el usuario **bandit14**. Para este nivel, no obtienes la siguiente contraseña, pero obtienes una clave SSH privada que puede ser usada para iniciar sesión en el siguiente nivel. Nota: localhost es un nombre de host que se refiere a la máquina en la que estás trabajando.

----------------

### Descripción de Comandos {#Exp13}

#### Llave Privada y Pública de Servicio SSH {#llaves}

| **Llaves del Servicio SSH** |
|:-----------:|
| *Las llaves públicas y privadas en SSH son un mecanismo utilizado para la autenticación segura entre un cliente y un servidor. En lugar de usar contraseñas, se emplea criptografía asimétrica con un par de llaves: una llave privada (que se mantiene secreta) y una llave pública (que se comparte).* | 

| **Llaves Privada** |
|:-----------:|
| *Es un archivo que solo el usuario debe tener. Se guarda en el cliente y nunca se comparte. Es usada para desencriptar los mensajes cifrados con la llave pública y para firmar los mensajes enviados.* |

| **Llaves Pública** |
|:-----------:|
| *Es un archivo que se puede compartir con cualquier persona o servidor. Se coloca en el servidor al que deseas conectarte. El servidor usa esta llave para cifrar los datos y verificar la autenticidad de quien se conecta.* |

Pasos para la creación, distribución y autenticación de llaves:
* **Generación de llaves**: El usuario genera un par de llaves (pública y privada).
* **Distribución de la llave pública**: El usuario coloca la llave pública en el servidor al que quiere conectarse. La llave pública se agrega al archivo **~/.ssh/authorized_keys** en el servidor.
* **Autenticación:** 
	* Cuando el cliente intenta conectarse al servidor, el servidor envía un desafío cifrado con la llave pública del usuario.
	* El cliente usa su llave privada para desencriptar el desafío.
	* Si el cliente puede desencriptar correctamente, la autenticación se completa y se establece la conexión.

Formas de uso:

* Generando llaves:
```bash
ssh-keygen -t rsa -b 4096 -C "tu_email@example.com"
```
Esto va a generar la llave privada (**~/.ssh/id_rsa**) y la llave pública (**~/.ssh/id_rsa.pub**).

* Copiando la llave pública al servidor, esto para permitir la autenticación sin contraseña:
```bash
ssh-copy-id usuario@servidor
```

* Conectandose al servidor usando la llave privada:
```bash
ssh -i id_rsa usuario@servidor
```

Acá dejo más información sobre **llaves SSH**:
* <a href="http://codigoelectronica.com/blog/ssh-key-guia-completa-de-las-llaves-publicas-y-privadas-de-ssh" target="_blank">SSH key: guía completa de las llaves públicas y privadas de SSH</a>

**Continuemos con la solución.**

### Solución {#Sol13}

Primero entremos al **servicio SSH**:
```bash
ssh bandit13@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit13@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 12**.

Veamos la llave privada que menciona las instrucciones:
```bash
bandit13@bandit:~$ ls -la
total 24
drwxr-xr-x  2 root     root     4096 Sep 19 07:08 .
drwxr-xr-x 70 root     root     4096 Sep 19 07:09 ..
-rw-r--r--  1 root     root      220 Mar 31 08:41 .bash_logout
-rw-r--r--  1 root     root     3771 Mar 31 08:41 .bashrc
-rw-r--r--  1 root     root      807 Mar 31 08:41 .profile
-rw-r-----  1 bandit14 bandit13 1679 Sep 19 07:08 sshkey.private
```

Analicemos un poco la llave privada:
```bash
bandit13@bandit:~$ file sshkey.private 
sshkey.private: PEM RSA private key
bandit13@bandit:~$ cat sshkey.private 
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAxkkOE83W2cOT7IWhFc9aPaaQmQDdgzuXCv+ppZHa++buSkN+
gg0tcr7Fw8NLGa5+Uzec2rEg0WmeevB13AIoYp0MZyETq46t+jk9puNwZwIt9XgB
...
...
...
```

La idea es que nosotros nos conectemos al siguiente nivel usando la llave privada, no es nada más que eso. Debemos especificar el usuario **bandit14** y usamos el servidor local.

Ahora conectemonos al siguiente nivel, usando la llave privada:
```bash
bandit13@bandit:~$ ssh -i sshkey.private bandit14@localhost -p 2220
The authenticity of host '[localhost]:2220 ([127.0.0.1]:2220)' can't be established.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Could not create directory '/home/bandit13/.ssh' (Permission denied).
Failed to add the host to the list of known hosts (/home/bandit13/.ssh/known_hosts).
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

!!! You are trying to log into this SSH server with a password on port 2220 from localhost.
!!! Connecting from localhost is blocked to conserve resources.
!!! Please log out and log in again.
...
...
...
bandit14@bandit:~$ whoami
bandit14
```

Excelente, ahora simplemente veamos la contraseña en la ruta que menciona las instrucciones:
```bash
bandit14@bandit:~$ cat /etc/bandit_pass/bandit14
...
```
Hemos terminado este nivel.

## Nivel 14 a 15 {#Nivel14}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se puede recuperar enviando la contraseña del nivel actual al **puerto 30000 en localhost**.

----------------

### Descripción de Comandos {#Exp14}

#### Comando nc {#nc}

| **Comando nc** |
|:-----------:|
| *El comando nc, también conocido como Netcat, es una herramienta de red versátil en Linux que permite crear conexiones de red de manera sencilla, tanto TCP como UDP. Se utiliza para enviar y recibir datos a través de redes, y es útil para diagnósticos de red, transferencias de archivos, escaneo de puertos, y creación de servidores simples.* |

Formas de uso:
```bash
nc [opciones] [host] [puerto]
```

Ejemplo:
* Conectandonos a un servidor en un puerto específico:
```bash
nc ejemplo.com 80
```

* Creando servidor para escuchar en un puerto específico:
```bash
nc -l 1234
```

* Creando servidor para escuchar de manera persistente en un puerto específico, sin resolver nombres de host y mostrando detalles verbosos sobre cualquier conexión entrante:
```bash
nc -lnvp 443
```

**Continuemos con la solución.**

### Solución {#Sol14}

Primero entremos al **servicio SSH**:
```bash
ssh bandit14@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit14@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 13**.

Esto es bastante simple, una vez que entremos podemos directamente obtener la contraseña para el siguiente nivel con el **comando nc**.

Vamos a probarlo, recuerda que debes escribir la contraseña del nivel actual para que te de la del siguiente nivel:
```bash
bandit14@bandit:~$ nc localhost 30000
contraseña_nivel_actual
Correct!
...
```

Observa lo que pasa si te equivocas:
```bash
bandit14@bandit:~$ nc localhost 30000
ls
Wrong! Please enter the correct current password.
```

Listo, ya terminamos con este nivel.

## Nivel 15 a 16 {#Nivel15}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se puede recuperar enviando la contraseña del nivel actual al **puerto 30001 en localhost** utilizando **encriptación SSL/TLS**.

**Nota útil**: ¿Recibes **"DONE"**, **"RENEGOTIATING"** o **"KEYUPDATE"**? Lea la sección **"CONNECTED COMMANDS"** en la página de manual.

----------------

### Descripción de Comandos {#Exp15}

#### Comando ncat {#ncat}

| **Comando ncat** |
|:-----------:|
| *ncat es una herramienta de red mejorada basada en Netcat que forma parte del proyecto Nmap. Ncat ofrece más características avanzadas para realizar conexiones de red, incluyendo soporte para SSL/TLS, redireccionamiento de puertos, autenticación y múltiples clientes. Es útil para transferencias de archivos, pruebas de conectividad, diagnóstico de redes, y más.* |

Formas de uso:
```bash
ncat [opciones] [host] [puerto]
```

Ejemplo:
* Conectandonos a un servidor en un puerto específico:
```bash
ncat ejemplo.com 80
```

* Realizando una conexión segura con **SSL**:
```bash
ncat --ssl ejemplo.com 443
```

* Aplicando redirección de puertos:
```bash
ncat -l 8080 --sh-exec "ncat ejemplo.com 80"
```

**Continuemos con la solución.**

### Solución {#Sol15}

Primero entremos al **servicio SSH**:
```bash
ssh bandit15@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit15@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 14**.

Es muy simple lo que tenemos que hacer, es lo mismo que hicimos en el nivel anterior, pero usando el **comando ncat** y usando el **parámetro --ssl** para crear una conexión segura, nos pedira la contraseña de la sesión actual y cuando se la demos, nos dara la contraseña del siguiente nivel.

Vamos a probar:

* Vamos a usar el comando ncat para conectarnos al localhost por el puerto 30001 y creando una conexión segura:
```bash
bandit15@bandit:~$ ncat --ssl 127.0.0.1 30001
contraseña_nivel_actual
Correct!
...
```

Y listo, no hay más que hacer. Vayamos al siguiente nivel.

## Nivel 16 a 17 {#Nivel16}

**INSTRUCCIONES**:

Las credenciales para el siguiente nivel se pueden recuperar enviando la contraseña del nivel actual a un puerto en localhost en el rango 31000 a 32000. Primero averigua cuáles de estos puertos tienen un servidor escuchando en ellos. Luego averigua cuáles de ellos hablan SSL/TLS y cuáles no. Sólo hay 1 servidor que te dará las siguientes credenciales, los otros simplemente te devolverán lo que les envíes.

Nota útil: ¿Recibes "DONE", "RENEGOTIATING" o "KEYUPDATE"? Lee la sección "COMANDOS CONECTADOS" en la página de manual.

----------------

### Descripción de Comandos {#Exp16}

#### Comando chmod {#chmod}

| **Comando chmod** |
|:-----------:|
| *El comando chmod se utiliza para cambiar los permisos de acceso a archivos y directorios en sistemas Unix y Linux. Los permisos controlan quién puede leer, escribir o ejecutar un archivo.* |

Formas de uso:
```bash
chmod [opciones] mode archivo
```

Permisos en formato numérico:
* 4 = Leer (r)
* 2 = Escribir (w)
* 1 = Ejecutar (x)

Los permisos se suman para cada conjunto de usuarios:

* El primer número es para el dueño.
* El segundo número es para el grupo.
* El tercer número es para otros.

Ejemplo:
* Dando al propietario todos los permisos (rwx), al grupo permisos de lectura y ejecución (rx), y a otros solo de lectura (r) de un archivo:
```bash
chmod 755 archivo.txt
```

* Añadiendo permisos de escritura para el propietario:
```bash
chmod u+w archivo.txt
```

* Cambiando permisos de manera recursiva en un directorio:
```bash
chmod -R 644 directorio/
```

#### Comando mktemp {#mktemp}

| **Comando mktemp** |
|:-----------:|
| *El comando mktemp se utiliza para crear archivos o directorios temporales de manera segura. Genera nombres únicos para evitar colisiones, lo cual es útil en scripts donde se requieren archivos temporales.* |

Formas de uso: 
```bash
mktemp [opciones] [template]
```

**template** es opcional y debe contener una serie de "X" que serán reemplazadas por un identificador único.

Opciones comunes:
* **-d**: Crea un directorio temporal en lugar de un archivo.
* **-q**: Silencia mensajes de error.

Ejemplo:
* Creando un archivo temporal y mostrar su nombre:
```bash
mktemp
```

* Creando un directorio temporal:
```bash
mktemp -d
```

#### Comando nmap {#nmap}

| **Comando nmap** |
|:-----------:|
| *Nmap es una herramienta de código abierto usada para el escaneo y descubrimiento de redes. Se utiliza principalmente para realizar auditorías de seguridad y pruebas de penetración, pero también sirve para administrar redes y obtener información sobre hosts y servicios disponibles.* |

Formas de uso: 
```bash
nmap [opciones] [objetivo]
```

Ejemplo:
* Escaneo básico de un host:
```bash
nmap 192.168.1.1
```

* Escaneo de todos los puertos:
```bash
nmap -p- 192.168.1.1
```

* Escaneo de puertos y detección de versiones:
```bash
nmap -sV -p 80,443 192.168.1.1
```

RECOMENDABLE: echale un vistaso y estudia bien el uso de nmap, porque es una de las mejores herramientas y necesarias que todo pentester debe conocer.

* <a href="https://nmap.org/" target="_blank">Herramienta NMAP</a>

**Continuemos con la solución.**

### Solución {#Sol16}

Primero entremos al **servicio SSH**:
```bash
ssh bandit16@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit16@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 15**.

El proceso es similar al anterior nivel, pero primero debemos identificar que puertos estan actives entre el **puerto 31000 y 32000**, entre estos debe haber un puerto que utilice **SSL/TLS** y ahí aplicaremos el mismo proceso que el nivel anterior.

Entonces, vamos a ocupar la herramienta **nmap** para identificar los puertos abiertos y cual utiliza **SSL/TLS**.

Empecemos creando un directorio temporal y aplicando un **comando de nmap** que nos de los puertos abiertos:
```bash
bandit16@bandit:~$ cd /tmp
bandit16@bandit:/tmp$ mktemp -d
/tmp/tmp.jh1Azu9X8B
bandit16@bandit:/tmp$ cd /tmp/tmp.jh1Azu9X8B
bandit16@bandit:/tmp/tmp.jh1Azu9X8B$
bandit16@bandit:/tmp/tmp.jh1Azu9X8B$ nmap --open -p 31000-32000 -T5 -vvv -n -Pn 127.0.0.1
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Initiating Connect Scan at 01:17
Scanning 127.0.0.1 [1001 ports]
Discovered open port 31790/tcp on 127.0.0.1
Discovered open port 31046/tcp on 127.0.0.1
Discovered open port 31518/tcp on 127.0.0.1
Discovered open port 31960/tcp on 127.0.0.1
Discovered open port 31691/tcp on 127.0.0.1
Completed Connect Scan at 01:17, 0.04s elapsed (1001 total ports)
Nmap scan report for 127.0.0.1
Host is up, received user-set (0.00016s latency).
Not shown: 996 closed tcp ports (conn-refused)
PORT      STATE SERVICE REASON
31046/tcp open  unknown syn-ack
31518/tcp open  unknown syn-ack
31691/tcp open  unknown syn-ack
31790/tcp open  unknown syn-ack
31960/tcp open  unknown syn-ack
```

Ya identificamos los puertos, ahora veamos cual de ellos usa **SSL/TLS**, para esto utilizaremos el **script ssl-enum-ciphers de nmap**:
```bash
bandit16@bandit:/tmp/tmp.jh1Azu9X8B$ nmap --script ssl-enum-ciphers -p 31046,31518,31691,31790,31960 127.0.0.1
Nmap scan report for localhost (127.0.0.1)
Host is up (0.00026s latency).

PORT      STATE SERVICE
31046/tcp open  unknown
31518/tcp open  unknown

| ssl-enum-ciphers: 
|   TLSv1.2: 
|     ciphers: 
|       TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA (secp256r1) - A
|       TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256 (secp256r1) - A
|       TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 (secp256r1) - A
...
...
31691/tcp open  unknown
31790/tcp open  unknown

| ssl-enum-ciphers: 
|   TLSv1.2: 
|     ciphers: 
|       TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA (secp256r1) - A
|       TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256 (secp256r1) - A
|       TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 (secp256r1) - A
...
...
```

Hay dos puertos que lo utilizan, probemos a conectarnos a ambos y pasemos la contraseña del nivel actual para ver que nos devuelve:
```bash
bandit16@bandit:/tmp/tmp.jh1Azu9X8B$ ncat --ssl 127.0.0.1 31518
contraseña_nivel_actual
^C
bandit16@bandit:/tmp/tmp.jh1Azu9X8B$ ncat --ssl 127.0.0.1 31790
contraseña_nivel_actual
Correct!
-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQEAvmOkuifmMg6HL2YPIOjon6iWfbp7c3jx34YkYWqUH57SUdyJ
imZzeyGC0gtZPGujUSxiJSWI/oTqexh+cAMTSMlOJf7+BrJObArnxd9Y7YT2bRPQ
...
...
```

Resulto ser el **puerto 31790**, si le damos la contraseña nos devuelve una llave privada, como ya hemos hecho antes vamos a copiar la llave, le daremos los permisos necesarios y la usaremos para conectarnos al siguiente nivel.

Vamos por pasos:
* Copiemos la llave en un archivo llamado **id_rsa**:
```bash
nano id_rsa
```

* Asignemosle los permisos correctos para que funcione la llave:
```bash
chmod 600 id_rsa
```

* Y probemos a conectarnos al siguiente nivel:
```bash
ssh -i id_rsa bandit17@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
...
...
...
Enjoy your stay!
*
bandit17@bandit:~$ ls -la
total 36
drwxr-xr-x  3 root     root     4096 Sep 19 07:08 .
drwxr-xr-x 70 root     root     4096 Sep 19 07:09 ..
-rw-r-----  1 bandit17 bandit17   33 Sep 19 07:08 .bandit16.password
-rw-r--r--  1 root     root      220 Mar 31 08:41 .bash_logout
-rw-r--r--  1 root     root     3771 Mar 31 08:41 .bashrc
-rw-r-----  1 bandit18 bandit17 3300 Sep 19 07:08 passwords.new
-rw-r-----  1 bandit18 bandit17 3300 Sep 19 07:08 passwords.old
-rw-r--r--  1 root     root      807 Mar 31 08:41 .profile
drwxr-xr-x  2 root     root     4096 Sep 19 07:08 .ssh
```

Si lo deseas, la contraseña de este nivel se encuentra en: 
```bash
bandit17@bandit:~$ ls -l /etc/bandit_pass/bandit17
-r-------- 1 bandit17 bandit17 33 Sep 19 07:07 /etc/bandit_pass/bandit17
bandit17@bandit:~$ cat /etc/bandit_pass/bandit17
...
```
Continuemos al siguiente nivel.

## Nivel 17 a 18 {#Nivel17}

**INSTRUCCIONES**:

Hay 2 archivos en el homedirectory: **passwords.old y passwords.new**. La contraseña para el siguiente nivel está en **passwords.new** y es la única línea que ha cambiado entre **passwords.old y passwords.new**.

**NOTA**: si has resuelto este nivel y ves "Byebye!" cuando intentas entrar en **bandit18**, esto está relacionado con el siguiente nivel, **bandit19**.

----------------

### Descripción de Comandos {#Exp17}

#### Comando diff {#diff}

| **Comando diff** |
|:-----------:|
| *El comando diff se utiliza para comparar el contenido de dos archivos o directorios en sistemas Unix y Linux. Muestra las diferencias línea por línea, ayudando a identificar cambios o modificaciones entre los archivos. diff toma dos archivos como entrada y compara su contenido. Si encuentra diferencias, muestra las líneas que difieren entre los archivos.* |

Formas de uso:
```bash
diff [opciones] archivo1 archivo2
```

Ejemplo:
* Comparando dos archivos simples:
```bash
diff archivo1.txt archivo2.txt
```

* Usando el formato unificado para una mejor legibilidad:
```bash
diff -u archivo1.txt archivo2.txt
```

* Comparando dos directorios:
```bash
diff -r directorio1 directorio2
```

**Continuemos con la solución.**

### Solución {#Sol17}

Primero entremos al **servicio SSH**:
```bash
ssh bandit17@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
*
bandit17@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 16**.

Es muy simple la solución, unicamente usaremos el **comando diff** para encontrar la diferencia entre ambos archivos, dicha diferencia será la contraseña para el siguiente nivel.

Vamos a probarlo:
```bash
bandit17@bandit:~$ ls -la
total 36
drwxr-xr-x  3 root     root     4096 Sep 19 07:08 .
drwxr-xr-x 70 root     root     4096 Sep 19 07:09 ..
-rw-r-----  1 bandit17 bandit17   33 Sep 19 07:08 .bandit16.password
-rw-r--r--  1 root     root      220 Mar 31 08:41 .bash_logout
-rw-r--r--  1 root     root     3771 Mar 31 08:41 .bashrc
-rw-r-----  1 bandit18 bandit17 3300 Sep 19 07:08 passwords.new
-rw-r-----  1 bandit18 bandit17 3300 Sep 19 07:08 passwords.old
-rw-r--r--  1 root     root      807 Mar 31 08:41 .profile
drwxr-xr-x  2 root     root     4096 Sep 19 07:08 .ssh
bandit17@bandit:~$ diff passwords.old passwords.new
42c42
< linea_diferencia
---
> contraseña_bandit18
```
Y listo, ya tenemos la contraseña, pero recuerda las instrucciones pues si la probamos en el siguiente nivel, automaticamente nos sacara.

## Nivel 18 a 19 {#Nivel18}

**INSTRUCCIONES**:

La contraseña para el siguiente nivel se almacena en un archivo **readme en el homedirectory**. Desafortunadamente, alguien ha modificado .bashrc para cerrar la sesión cuando te conectas con **SSH**.

----------------

### Descripción de Comandos {#Exp18}

#### Comando sshpass {#sshpass}

| **Comando sshpass** |
|:-----------:|
| *sshpass es una utilidad que permite proporcionar una contraseña de manera no interactiva para comandos que utilizan SSH (como ssh, scp, o rsync). En lugar de introducir la contraseña manualmente cuando te conectas a un servidor remoto, sshpass la suministra automáticamente. Es útil en scripts de automatización donde no es posible o conveniente usar autenticación con claves SSH.* |

Formas de uso:
```bash
sshpass -p 'contraseña' comando_ssh
```

Ejemplo:
* Conectandonos a un **servidor SSH** con una contraseña:
```bash
sshpass -p 'mi_contraseña' ssh usuario@servidor.com
```

* Copiando archivos con **comando scp** usando una contraseña:
```bash
sshpass -p 'mi_contraseña' scp archivo.txt usuario@servidor.com:/ruta/destino/
```

**Continuemos con la solución.**

### Solución {#Sol18}

Primero entremos al **servicio SSH**:
```bash
ssh bandit18@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
*
bandit18@bandit.labs.overthewire.org's password:
...
...
...
Welcome to OverTheWire!
Byebye !
Connection to bandit.labs.overthewire.org closed.
```
La contraseña es la que encontraste en el **nivel 17**.

Como bien mencionan las instrucciones, una vez que intentamos entrar nos saca. Para este caso, vamos a utilizar el **comando sshpass** para poder leer la contraseña.

Probemos:

* Intentemos ejecutar el **comando whoami** con el **comando sshpass**:
```bash
sshpass -p 'contraseña_nivel_actual' ssh bandit18@bandit.labs.overthewire.org -p2220 whoami
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
*
bandit18
```

* Ahora veamos si es verdad que se encuentra un archivo llamado **readme** en el **directorio /home**
```bash
sshpass -p 'contraseña_nivel_actual' ssh bandit18@bandit.labs.overthewire.org -p2220 ls
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
*
readme
```

* Ahí esta, tan solo hay que leerlo:
```bash
sshpass -p 'contraseña_nivel_actual' ssh bandit18@bandit.labs.overthewire.org -p2220 cat readme
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
*
contraseña_siguiente_nivel
```

* También podemos obtener una **sesión interactiva de Bash**:
```bash
sshpass -p 'x2gLTTjFwMOhQ8oWNbMN362QKxfRqGlO' ssh bandit18@bandit.labs.overthewire.org -p2220 bash
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
*
whoami
bandit18
ls
readme
cat readme
contraseña_siguiente_nivel
^C#
```

Y listo, ya podemos ir al siguiente nivel.

## Nivel 19 a 20 {#Nivel19}

**INSTRUCCIONES**:

Para acceder al siguiente nivel, debe utilizar el **binario setuid** en el **directorio home**. Ejecútalo sin argumentos para saber cómo usarlo. La contraseña para este nivel se puede encontrar en el lugar habitual **(/etc/bandit_pass)**, después de haber utilizado el **binario setuid**.

----------------

### Descripción de Comandos {#Exp19}

#### Permiso SUID {#suid}

| **Permiso SUID** |
|:-----------:|
| *El bit SUID (Set User ID) es un permiso especial en sistemas Unix y Linux que, cuando se aplica a un archivo ejecutable, permite que el archivo se ejecute con los privilegios del propietario del archivo, en lugar de los privilegios del usuario que lo ejecuta. Esto es especialmente útil para programas que necesitan privilegios elevados temporalmente. Por ejemplo, el comando passwd utiliza SUID para permitir que los usuarios cambien sus contraseñas, ya que modifica archivos del sistema que solo el superusuario puede cambiar, como /etc/shadow.* |

Formas de uso:
```bash
./script_con_permisos_SUID
```

Ejemplo:
* Ejecutando script con **permisos SUID**:
```bash
./bandit20-do id
```

* Hacer un archivo ejecutable con **SUID**:
```bash
chmod u+s mi_script
```

* Verificar si un archivo tiene **SUID activado**:
```bash
ls -l /usr/bin/passwd
-rwsr-xr-x 1 root root 150K Aug  5 14:20 /usr/bin/passwd
```
El **permiso rws** en lugar de **rwx** indica que **el bit SUID está activado**.

**Continuemos con la solución.**

### Solución {#Sol19}

Primero entremos al **servicio SSH**:
```bash
ssh bandit19@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit19@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 18**.

De acuerdo a las instrucciones, lo unico que debemos hacer es usar el **script bandit20-do** para ejecutar comandos como **bandit20**, vamos a probar si es cierto.

Probemos:
* Ejecutemos el script para ver como se usa:
```bash
bandit19@bandit:~$ ls -la
total 36
drwxr-xr-x  2 root     root      4096 Sep 19 07:08 .
drwxr-xr-x 70 root     root      4096 Sep 19 07:09 ..
-rwsr-x---  1 bandit20 bandit19 14880 Sep 19 07:08 bandit20-do
-rw-r--r--  1 root     root       220 Mar 31 08:41 .bash_logout
-rw-r--r--  1 root     root      3771 Mar 31 08:41 .bashrc
-rw-r--r--  1 root     root       807 Mar 31 08:41 .profile
bandit19@bandit:~$ ./bandit20-do 
Run a command as another user.
  Example: ./bandit20-do id
```

* Ejecutemos el mismo comando de ejemplo que nos pone el script:
```bash
bandit19@bandit:~$ ./bandit20-do id
uid=11019(bandit19) gid=11019(bandit19) euid=11020(bandit20) groups=11019(bandit19)
```

* Veamos con el **comando whoami**:
```bash
bandit19@bandit:~$ ./bandit20-do whoami
bandit20
```

* Excelente, vamos a obtener la contraseña en la ruta que nos indicaron las instrucciones:
```bash
bandit19@bandit:~$ ./bandit20-do cat /etc/bandit_pass/bandit20
...
```

* Por último, podemos obtener una **sesión interactiva de bash**:
```bash
bandit19@bandit:~$ ./bandit20-do bash -p
bash-5.2$ whoami
bandit20
bash-5.2$ ls -la
total 36
drwxr-xr-x  2 root     root      4096 Sep 19 07:08 .
drwxr-xr-x 70 root     root      4096 Sep 19 07:09 ..
-rwsr-x---  1 bandit20 bandit19 14880 Sep 19 07:08 bandit20-do
-rw-r--r--  1 root     root       220 Mar 31 08:41 .bash_logout
-rw-r--r--  1 root     root      3771 Mar 31 08:41 .bashrc
-rw-r--r--  1 root     root       807 Mar 31 08:41 .profile
bash-5.2$ cat /etc/bandit_pass/bandit20
contraseñ_siguiente_nivel
bash-5.2$ exit
exit
bandit19@bandit:~$ exit
logout
Connection to bandit.labs.overthewire.org closed.
```
Continuemos al siguiente nivel.

## Nivel 20 a 21 {#Nivel20}

**INSTRUCCIONES**:

Hay un **binario setuid** en el **homedirectory** que hace lo siguiente: establece una conexión con **localhost** en el puerto que especifiques como argumento en la línea de comandos. Luego lee una línea de texto de la conexión y la compara con **la contraseña del nivel anterior (bandit20)**. Si la contraseña es correcta, **transmitirá la contraseña para el siguiente nivel (bandit21)**.

**NOTA**: Prueba a conectarte a tu propio demonio de red para ver si funciona como crees

----------------

### Solución {#Sol20}

Primero entremos al **servicio SSH**:
```bash
ssh bandit20@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit20@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 19**.

La idea es que establescamos una conexión en el nivel actual y nuestra máquina (aunque supongo que podemos realizar la conexión dentro del mismo nivel, pero en otra terminal), una vez realizada la conexión, debemos dar la contraseña del nivel actual para que nos responda con la contraseña del siguiente nivel.

Vamos a probarlo:

* Ejecutemos el binario para ver su uso:
```bash
bandit20@bandit:~$ ls
suconnect
bandit20@bandit:~$ ls -la
total 36
drwxr-xr-x  2 root     root      4096 Sep 19 07:08 .
drwxr-xr-x 70 root     root      4096 Sep 19 07:09 ..
-rw-r--r--  1 root     root       220 Mar 31 08:41 .bash_logout
-rw-r--r--  1 root     root      3771 Mar 31 08:41 .bashrc
-rw-r--r--  1 root     root       807 Mar 31 08:41 .profile
-rwsr-x---  1 bandit21 bandit20 15604 Sep 19 07:08 suconnect
bandit20@bandit:~$ ./suconnect 
Usage: ./suconnect <portnumber>
This program will connect to the given port on localhost using TCP. If it receives the correct password from the other side, the next password is transmitted back.
```
Ya vimos que es un binario que se conecta a un puerto que específiquemos dentro de **localhost**.

* Usando el **comando nc** pongamonos en modo escucha por un puerto random:
```bash
bandit20@bandit:~$ nc -nlvp 4444
Listening on 0.0.0.0 4444
```

* En otra terminal, entremos al mismo nivel y usemos el binario para conectarnos al puerto que esta en modo escucha:
```bash
bandit20@bandit:~$ ./suconnect 4444
...
```

* Ahora, pasemos la contraseña del nivel actual en la primer terminal y veamos si nos responde:
```bash
bandit20@bandit:~$ nc -nlvp 4444
Listening on 0.0.0.0 4444
Connection received on 127.0.0.1 43858
contraseña_nivel_actual
contraseña_siguiente_nivel
```

* Nos dio la contraseña del siguiente nivel, observa lo que menciona la segunda terminal:
```bash
bandit20@bandit:~$ ./suconnect 4444
Read: contraseña_nivel_actual
Password matches, sending next password
```

Y listo, pasemos al siguiente nivel.

## Nivel 21 a 22 {#Nivel21}

**INSTRUCCIONES**:

Un programa se está ejecutando automáticamente a intervalos regulares desde **cron**, el programador de trabajos basado en el tiempo. Busque en **/etc/cron.d/** la configuración y vea qué comando se está ejecutando.

----------------

### Descripción de Comandos {#Exp21}

#### Servicio CRON {#cron}

| **Servicio CRON** |
|:-----------:|
| *cron es un servicio en sistemas Unix y Linux que se utiliza para programar la ejecución de tareas de manera periódica o en un momento específico. Este demonio ejecuta trabajos en segundo plano a intervalos regulares según lo configurado en el archivo crontab.* |

| **Comando crontab** |
|:-----------:| 
| *crontab (abreviatura de cron table) es un archivo que contiene la lista de tareas a ejecutar por cron, junto con los tiempos y fechas en que se deben ejecutar. También es el nombre del comando que permite al usuario editar su tabla de trabajos cron.* |

Formas de uso:
```bash
* * * * * comando
```
Cada asterisco representa un valor de tiempo:

* Minuto (0-59)

* Hora (0-23)

* Día del mes (1-31)

* Mes (1-12 o abreviaturas de mes como jan, feb, etc.)

* Día de la semana (0-6, donde 0 es domingo, o abreviaturas como mon, tue, etc.)

Ejemplo:
* Ver el archivo crontab del usuario:
```bash
crontab -l
```
Muestra los **trabajos cron** configurados para el usuario actual.

* Editar el archivo crontab del usuario:
```bash
crontab -e
```

* Eliminar el archivo crontab del usuario:
```bash
crontab -r
```

Ejemplos de configuración:

* Ejecutar un script todos los días a las 2:30 AM:
```bash
30 2 * * * /ruta/al/script.sh
```
Esto ejecutará el **script script.sh** todos los días a las 2:30 de la madrugada.

* Ejecutar un comando cada 5 minutos:
```bash
*/5 * * * * /ruta/al/comando.sh
```
El */5 significa "cada 5 minutos". Este trabajo se ejecutará cada 5 minutos.

* Enviar un recordatorio por correo electrónico todos los viernes a las 4:00 PM:
```bash
0 16 * * 5 echo "Recordatorio de reunión" | mail -s "Reunión semanal" user@example.com
```
Este trabajo enviará un correo con el recordatorio a las 4:00 PM todos los viernes.

**Continuemos con la solución.**

### Solución {#Sol21}

Primero entremos al **servicio SSH**:
```bash
ssh bandit21@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit21@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 20**.

Debemos buscar que se esta ejecutando en las **tareas cron**, una vez que identifiquemos que se esta ejecutando, debemos seguir ese hilo hasta obtener la contraseña.

Probemos:

* Veamos que tareas estan ejecutandose en la ruta que nos menciona las instrucciones:
```bash
bandit21@bandit:~$ ls -l /etc/cron.d/
total 24
-rw-r--r-- 1 root root 120 Sep 19 07:08 cronjob_bandit22
-rw-r--r-- 1 root root 122 Sep 19 07:08 cronjob_bandit23
-rw-r--r-- 1 root root 120 Sep 19 07:08 cronjob_bandit24
-rw-r--r-- 1 root root 201 Apr  8 14:38 e2scrub_all
-rwx------ 1 root root  52 Sep 19 07:10 otw-tmp-dir
-rw-r--r-- 1 root root 396 Jan  9  2024 sysstat
```
Observa que hay tareas para los siguientes dos niveles.

* Veamos el contenido de la tarea de **bandit22**:

```bash
bandit21@bandit:~$ cat /etc/cron.d/cronjob_bandit22
@reboot bandit22 /usr/bin/cronjob_bandit22.sh &> /dev/null
* * * * * bandit22 /usr/bin/cronjob_bandit22.sh &> /dev/null
```
Se esta ejecutando un binario, al parecer cada minuto.

* Veamos el contenido del binario que se esta ejecutando:
```bash
bandit21@bandit:~$ cat /usr/bin/cronjob_bandit22.sh
#!/bin/bash
chmod 644 /tmp/t7O6lds9S0RqQh9aMcz6ShpAoZKF7fgv
cat /etc/bandit_pass/bandit22 > /tmp/t7O6lds9S0RqQh9aMcz6ShpAoZKF7fgv
```
Parece que esta creando un archivo temporal y guarda la contraseña de **bandit22** dentro de este archivo temporal, esto cada minuto.

* Veamos el contenido del archivo dentro del directorio temporal:
```bash
bandit21@bandit:~$ cat /tmp/t7O6lds9S0RqQh9aMcz6ShpAoZKF7fgv
contraseña_siguiente_nivel
```

Y listo, ya tenemos la contraseña del siguiente nivel.

## Nivel 22 a 23 {#Nivel22}

**INSTRUCCIONES**:

Un programa se está ejecutando automáticamente a intervalos regulares desde **cron**, el programador de trabajos basado en el tiempo. Busque en **/etc/cron.d/** la configuración y vea qué comando se está ejecutando.

**NOTA**: Mirar scripts de shell escritos por otras personas es una habilidad muy útil. El script para este nivel está hecho intencionalmente fácil de leer. Si tienes problemas para entender lo que hace, intenta ejecutarlo para ver la información de depuración que imprime.

----------------

### Descripción de Comandos {#Exp22}

#### Comando md5sum {#md5sum}

| **Comando md5sum** |
|:-----------:|
| *El comando md5sum se utiliza en sistemas Unix y Linux para generar y verificar sumas de verificación MD5 de archivos. MD5 (Message Digest Algorithm 5) es un algoritmo de hash criptográfico que produce un hash de 128 bits, típicamente representado como una cadena de 32 caracteres hexadecimales. Esta suma se utiliza comúnmente para verificar la integridad de los archivos, ya que cualquier cambio en un archivo genera una suma MD5 diferente.* |

Formas de uso:
```bash
md5sum [opciones] archivo
```

Ejemplo:

* Generar la **suma MD5 de un archivo**:
```bash
md5sum archivo.txt
```
Esto genera y muestra la **suma MD5 de archivo.txt: d41d8cd98f00b204e9800998ecf8427e**. La salida consta del **hash MD5** seguido del nombre del archivo.

* Guardar la **suma MD5 en un archivo**:
```bash
md5sum archivo.txt > archivo.md5
```
Esto genera la **suma MD5 de archivo.txt** y la guarda en el **archivo archivo.md5**.

* Verificar la integridad de un archivo usando un **archivo de suma MD5**:
```bash
md5sum -c archivo.md5
```
Si la suma coincide, mostrará: **archivo.txt: OK**.

**Continuemos con la solución.**

### Solución {#Sol22}

Primero entremos al **servicio SSH**:
```bash
ssh bandit22@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit22@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 21**.

La solución es muy similar al nivel anterior, pero aquí vamos a analizar el script que se esta ejecutando.

Probemos:

* Veamos que tareas estan ejecutandose en la ruta que nos menciona las instrucciones:
```bash
bandit22@bandit:~$ ls -l /etc/cron.d/
total 24
-rw-r--r-- 1 root root 120 Sep 19 07:08 cronjob_bandit22
-rw-r--r-- 1 root root 122 Sep 19 07:08 cronjob_bandit23
-rw-r--r-- 1 root root 120 Sep 19 07:08 cronjob_bandit24
-rw-r--r-- 1 root root 201 Apr  8 14:38 e2scrub_all
-rwx------ 1 root root  52 Sep 19 07:10 otw-tmp-dir
-rw-r--r-- 1 root root 396 Jan  9  2024 sysstat
```

* Veamos el contenido de la tarea de **bandit23**:

```bash
bandit22@bandit:~$ cat /etc/cron.d/cronjob_bandit23
@reboot bandit23 /usr/bin/cronjob_bandit23.sh  &> /dev/null
* * * * * bandit23 /usr/bin/cronjob_bandit23.sh  &> /dev/null
```
Se esta ejecutando un binario, al parecer cada minuto.

* Veamos el contenido del binario que se esta ejecutando:
```bash
bandit22@bandit:~$ cat /usr/bin/cronjob_bandit23.sh
#!/bin/bash
myname=$(whoami)
mytarget=$(echo I am user $myname | md5sum | cut -d ' ' -f 1)
echo "Copying passwordfile /etc/bandit_pass/$myname to /tmp/$mytarget"
cat /etc/bandit_pass/$myname > /tmp/$mytarget
```
El script ocupa 2 variables, en la primer variable guarda el nombre del usuario (que es el usuario **bandit23**), en la segunda variable imprime una frase junto al contenido de la primer variable, el resultado lo convierte a **md5** y elimina los espacios. Después, imprime un mensaje que indica que se esta copiando la contraseña del archivo **/etc/bandit_pass/bandit23**, en un archivo con el nombre resultante de la segunda variable dentro del **directorio /tmp** y al final ocurre lo que menciona el mensaje, es decir, copia la contraseña de **bandit23** al archivo mencionado.

* Debemos encontrar el nombre de este archivo, para esto, vamos a copiar el comando que se ejecuta en la segunda variable y vamos a modificarlo, cambiando el comando para agregar el nombre **bandit23**:
```bash
bandit22@bandit:~$ echo I am user bandit23 | md5sum | cut -d ' ' -f 1
8ca319486bfbbc3663ea0fbe81326349
```

* Ya tenemos el nombre del archivo, ya solamente comprobamos si existe este archivo existe apuntando al **directorio /tmp**:
```bash
bandit22@bandit:~$ file /tmp/8ca319486bfbbc3663ea0fbe81326349
/tmp/8ca319486bfbbc3663ea0fbe81326349: ASCII text
```

* Si existe, ya solo ve el contenido para obtener la contraseña del siguiente nivel:
```bash
bandit22@bandit:~$ cat /tmp/8ca319486bfbbc3663ea0fbe81326349
...
```
Y listo.

## Nivel 23 a 24 {#Nivel23}

**INSTRUCCIONES**:

Un programa se está ejecutando automáticamente a intervalos regulares desde **cron**, el programador de trabajos basado en el tiempo. Busque en **/etc/cron.d/** la configuración y vea qué comando se está ejecutando.

**NOTA**: **Este nivel requiere que crees tu primer shell-script**. Este es un gran paso y deberías estar orgulloso de ti mismo cuando superes este nivel.

**NOTA 2**: Ten en cuenta que tu shell script es eliminado una vez ejecutado, así que quizás quieras mantener una copia...

----------------

### Descripción de Comandos {#Exp23}

#### Comando cp {#cp}

| **Comando cp** |
|:-----------:|
| *El comando cp (abreviatura de copy) se utiliza en sistemas Unix y Linux para copiar archivos y directorios de un lugar a otro. Puedes copiar uno o varios archivos a una ubicación nueva, o copiar directorios completos, dependiendo de las opciones que utilices.* |

Formas de uso:
```bash
cp [opciones] origen destino
```
* **origen**: Archivo o directorio que deseas copiar.
* **destino**: Lugar donde deseas copiar el archivo o directorio.

Ejemplo:
* Copiar un archivo a otra ubicación:
```bash
cp archivo.txt /ruta/destino/
```

* Copiar y renombrar un archivo:
```bash
cp archivo.txt archivo_copia.txt
```

* Copiar un directorio y su contenido:
```bash
cp -r /directorio_origen /ruta/destino/
```

#### Comando touch {#touch}

| **Comando touch** |
|:-----------:|
| *El comando touch se utiliza en sistemas Unix y Linux principalmente para crear archivos vacíos o actualizar las marcas de tiempo de archivos y directorios ya existentes, como la fecha y hora de modificación o acceso.* |

Formas de uso:
```bash
touch [opciones] archivo
```

Ejemplo:
* Creando un archivo vacío:
```bash
touch archivo.txt
```

* Actualizando la fecha y hora de acceso de un archivo:
```bash
touch -a archivo.txt
```

* Modificando solo la fecha de modificación:
```bash
touch -m archivo.txt
```

#### Comando watch {#watch}

| **Comando watch** |
|:-----------:|
| *El comando watch en sistemas Unix y Linux se utiliza para ejecutar periódicamente otro comando y mostrar su salida en la terminal. Es útil para monitorear cambios en tiempo real, ya que permite ejecutar un comando a intervalos regulares, actualizando la salida cada pocos segundos.* |

Formas de uso:
```bash
watch [opciones] comando
```
* **comando**: El comando que deseas ejecutar repetidamente.

Ejemplo:

* Monitorear el uso del disco:
```bash
watch df -h
```
Esto ejecuta el **comando df -h** cada 2 segundos y muestra el uso de disco en tiempo real.

* Monitorear los archivos en un directorio:
```bash
watch ls -l /ruta/del/directorio
```
Este comando ejecutará **ls -l** cada 2 segundos para mostrar los archivos de un directorio y actualizar la lista si hay cambios.

* Cambiar el intervalo de actualización:
```bash
watch -n 5 uptime
```
Esto ejecutará **uptime** cada 5 segundos, mostrando el tiempo que el sistema lleva activo y la carga promedio del sistema.

**Continuemos con la solución.**

### Solución {#Sol23}

Primero entremos al **servicio SSH**:
```bash
ssh bandit23@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit23@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 22**.

Igual que el nivel anterior, debemos ver que binario se esta ejecutando y analizar lo que hace.

Probemos:

* Veamos que tareas estan ejecutandose en la ruta que nos menciona las instrucciones:
```bash
bandit23@bandit:~$ ls -l /etc/cron.d/
total 24
-rw-r--r-- 1 root root 120 Sep 19 07:08 cronjob_bandit22
-rw-r--r-- 1 root root 122 Sep 19 07:08 cronjob_bandit23
-rw-r--r-- 1 root root 120 Sep 19 07:08 cronjob_bandit24
-rw-r--r-- 1 root root 201 Apr  8 14:38 e2scrub_all
-rwx------ 1 root root  52 Sep 19 07:10 otw-tmp-dir
-rw-r--r-- 1 root root 396 Jan  9  2024 sysstat
```

* Veamos el contenido de la tarea de **bandit24**:

```bash
bandit23@bandit:~$ cat /etc/cron.d/cronjob_bandit24
@reboot bandit24 /usr/bin/cronjob_bandit24.sh &> /dev/null
* * * * * bandit24 /usr/bin/cronjob_bandit24.sh &> /dev/null
```
Se esta ejecutando un binario, al parecer cada minuto.

* Veamos el contenido del binario que se esta ejecutando:
```bash
bandit23@bandit:~$ cat /usr/bin/cronjob_bandit24.sh
#!/bin/bash
myname=$(whoami)
cd /var/spool/$myname/foo
echo "Executing and deleting all scripts in /var/spool/$myname/foo:"
for i in * .*;
do
    if [ "$i" != "." -a "$i" != ".." ];
    then
        echo "Handling $i"
        owner="$(stat --format "%U" ./$i)"
        if [ "${owner}" = "bandit23" ]; then
            timeout -s 9 60 ./$i
        fi
        rm -f ./$i
    fi
done
```
Analizando el script, esta eliminando todo el contenido dentro del **directorio /var/spool/bandit24/foo**, pero si el usuario **bandit23** crea un archivo dentro de este directorio, tiene 60 segundos para ejecutarse antes de que sea terminado y eliminado ese archivo.

* Veamos que hay en el directorio **/var/spool** y **/var/spool/bandit24**:
```bash
bandit23@bandit:/tmp/tmp.IRhdxLMm05$ ls -la /var/spool
total 20
drwxr-xr-x  5 root     root     4096 Sep 19 07:08 .
drwxr-xr-x 13 root     root     4096 Sep 20 18:37 ..
dr-xr-x---  3 bandit24 bandit23 4096 Sep 19 07:08 bandit24
drwxr-xr-x  3 root     root     4096 Sep  6 09:22 cron
lrwxrwxrwx  1 root     root        7 Sep  6 09:22 mail -> ../mail
drwx------  2 syslog   adm      4096 Apr  8 14:49 rsyslog
bandit23@bandit:/tmp/tmp.IRhdxLMm05$ ls -la /var/spool/bandit24
total 12
dr-xr-x--- 3 bandit24 bandit23 4096 Sep 19 07:08 .
drwxr-xr-x 5 root     root     4096 Sep 19 07:08 ..
drwxrwx-wx 5 root     bandit24 4096 Sep 24 21:32 foo
```

* Vamos a crear un directorio de trabajo, le daremos permisos para que cualquiera pueda entrar, crear y leer y aquí crearemos un script que copie la contraseña de **bandit24** y la guarde en nuestro directorio de trabajo:
```bash
bandit23@bandit:~$ mktemp -d
/tmp/tmp.2ztZyiMlEo
bandit23@bandit:~$ cd /tmp/tmp.2ztZyiMlEo
bandit23@bandit:/tmp/tmp.2ztZyiMlEo$
bandit23@bandit:/tmp/tmp.2ztZyiMlEo$ chmod o+wx ../tmp.2ztZyiMlEo
bandit23@bandit:/tmp/tmp.2ztZyiMlEo$ nano script.sh
------
#!/bin/bash
cat /etc/bandit_pass/bandit24 > /tmp/tmp.2ztZyiMlEo/hackeado.txt
------
```

* Solo por si las dudas, vamos a crear un archivo random y lo vamos a copiar en el **directorio /var/spool/bandit24/foo** para comprobar que podemos guardar archivo ahí:
```bash
bandit23@bandit:/tmp/tmp.2ztZyiMlEo$ touch ejemplo.txt
bandit23@bandit:/tmp/tmp.2ztZyiMlEo$ cp ejemplo.txt /var/spool/bandit24/foo
```
Si nos dejo, entonces no hay problema.

* Una vez creado el script, vamos a darle permisos de ejecución y lo mandamos al **directorio /var/spool/bandit24/foo** y ahí también le daremos permisos de ejecución:
```bash
bandit23@bandit:/tmp/tmp.2ztZyiMlEo$ chmod +x script.sh 
bandit23@bandit:/tmp/tmp.2ztZyiMlEo$ cp script.sh /var/spool/bandit24/foo/script.sh
bandit23@bandit:/tmp/tmp.2ztZyiMlEo$ chmod +x /var/spool/bandit24/foo/script.sh 
```

* Con el **comando watch** esperamos alrededor de 1 minuto para ver si se copia el archivo con la contraseña en nuestro directorio de trabajo **(para salir del comando, usa CTRL + C)**:
```bash
Every 1.0s: ls -l                                        
total 4
-rw-rw-r-- 1 bandit23 bandit23  0 Sep 24 21:53 ejemplo.txt
-rw-rw-r-- 1 bandit24 bandit24 33 Sep 24 21:56 hackeado.txt
-rwxrwxr-x 1 bandit23 bandit23 82 Sep 24 21:54 script.sh
bandit23@bandit:/tmp/tmp.2ztZyiMlEo$ ls -la
total 168
drwx----wx    2 bandit23 bandit23   4096 Sep 24 21:56 .
drwxrwx-wt 1101 root     root     159744 Sep 24 21:56 ..
-rw-rw-r--    1 bandit23 bandit23      0 Sep 24 21:53 ejemplo.txt
-rw-rw-r--    1 bandit24 bandit24     33 Sep 24 21:56 hackeado.txt
-rwxrwxr-x    1 bandit23 bandit23     82 Sep 24 21:54 script.sh
bandit23@bandit:/tmp/tmp.2ztZyiMlEo$ cat hackeado.txt
...
```

Y listo, ya tenemos la contraseña para el siguiente nivel.

## Nivel 24 a 25 {#Nivel24}

**INSTRUCCIONES**:

Un **demonio** está escuchando en el **puerto 30002** y te dará la contraseña para **bandit25** si se le da la contraseña para **bandit24** y un **código secreto numérico de 4 dígitos**. No hay forma de recuperar el código PIN excepto **repasando todas las 10000 combinaciones**, lo que se denomina **forzar de forma bruta**.
No es necesario crear nuevas conexiones cada vez.

----------------

### Descripción de Comandos {#Exp24}

#### Comando wc {#wc}

| **Comando wc** |
|:-----------:|
| *El comando wc (abreviatura de word count) en sistemas Unix y Linux se utiliza para contar el número de líneas, palabras y caracteres en un archivo o en la entrada estándar. Es una herramienta útil para obtener estadísticas rápidas de texto.* |

Formas de uso:
```bash
wc [opciones] archivo
```

Ejemplo:
* Contando las líneas, palabras y caracteres de un archivo:
```bash
wc archivo.txt
```
La salida será algo como: `10  50 300 archivo.txt`

* Contando solo las líneas de un archivo:
```bash
wc -l archivo.txt
```

* Contar solo las palabras de un archivo:
```bash
wc -w archivo.txt
```

**Continuemos con la solución.**

### Solución {#Sol24}

Primero entremos al **servicio SSH**:
```bash
ssh bandit24@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit24@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 23**.

Tenemos que aplicar fuerza bruta al **puerto 30002** para que nos de la contraseña del siguiente nivel, entonces debemos crear un diccionario que contenga las 10000 combinaciones que se necesitan, para encontrar la combinación correcta.

Probemos:

* Primero, probemos la respuesta que obtenemos, al proporcionar la **contraseña del nivel actual y un PIN random** al **puerto 30002 del localhost**:
```bash
bandit24@bandit:~$ cat "contraseña_nivel_actual 1234" | nc localhost 30002
I am the pincode checker for user bandit25. Please enter the password for user bandit24 and the secret pincode on a single line, separated by a space.
Wrong! Please enter the correct current password and pincode. Try again.
^C
```

* Vamos a crear un directorio temporal y ahí trabajaremos:
```bash
bandit24@bandit:~$ mktemp -d
/tmp/tmp.sol9uLgkKS
bandit24@bandit:~$ cd /tmp/tmp.sol9uLgkKS
```

* Utilizando **programación en bash**, podemos imprimir 10 digitos ocupando un **bucle for** de la siguiente manera:
```bash
bandit24@bandit:/tmp/tmp.sol9uLgkKS$ for pin in {00..10}; do echo "$pin"; done
00
01
02
03
04
05
06
07
08
09
10
```

* Con esto, solamente cambiamos la cantidad de digitos a imprimir para que den 10000, pasamos la contraseña del nivel actual y lo guardamos todo en un archivo:
```bash
bandit24@bandit:/tmp/tmp.sol9uLgkKS$ for pin in {0000..9999}; do echo "gb8KRRCsshuZXI0tUuR6ypOFjiZbf3G8 bandit24 $pin"; done > pins.txt
bandit24@bandit:/tmp/tmp.sol9uLgkKS$ ls
pins.txt
```

* Podemos comprobar la cantidad de lineas que tiene el archivo con el **comando wc**:
```bash
bandit24@bandit:/tmp/tmp.sol9uLgkKS$ wc -l pins.txt
10000 pins.txt
```

* Ya solamente le pasamos estos datos al **puerto 30002** y con el **comando grep** filtramos los resultados para solo obtener el resultado que queremos:
```bash
bandit24@bandit:/tmp/tmp.sol9uLgkKS$ cat pins.txt | nc localhost 30002 | grep -v -E "Wrong|Please"
Correct!
The password of user bandit25 is contraseña_siguiente_nivel
```

Y listo, ya completamos este nivel.

## Nivel 25 a 26 a 27 {#Nivel25}

**INSTRUCCIONES**:

Entrar en **bandit26** desde **bandit25** debería ser bastante fácil... El shell para el usuario **bandit26** no es /bin/bash, sino otra cosa. Averigua qué es, cómo funciona y cómo salir de él.

**NOTA**: si eres un usuario de Windows y normalmente usas Powershell para hacer ssh en bandit: Powershell es conocido por causar problemas con la solución prevista a este nivel. Deberías usar símbolo del sistema en su lugar.

----------------

### Descripción de Comandos {#Exp25}

#### Comando more {#more}

| **Comando more** |
|:-----------:|
| *El comando more en Unix y Linux se utiliza para visualizar el contenido de archivos de texto de manera paginada. A diferencia de comandos como cat que muestran todo el contenido del archivo de una vez, more permite navegar por el archivo de forma progresiva, lo cual es útil para leer archivos largos.* |

Formas de uso:
```bash
more [opciones] archivo
```

Ejemplo:
* Ver el contenido de un archivo:
```bash
more archivo.txt
```

* Mostrar desde una línea específica:
```bash
more +20 archivo.txt
```

* Combinar con otros comandos:
```bash
dmesg | more
```

**Continuemos con la solución.**

### Solución {#Sol25}

Primero entremos al **servicio SSH**:
```bash
ssh bandit25@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit25@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 24**.

Esto será un poco complicado, ya que vamos a obtener la contraseña para **bandit 26 y bandit27**.

La idea principal es averiguar porque al conectarnos a **bandit26** nos saca al instante.

Probemos:

* Veamos que encontramos dentro del nivel actual:
```bash
bandit25@bandit:~$ ls -la
total 40
drwxr-xr-x  2 root     root     4096 Sep 19 07:08 .
drwxr-xr-x 70 root     root     4096 Sep 19 07:09 ..
-rw-r-----  1 bandit25 bandit25   33 Sep 19 07:08 .bandit24.password
-r--------  1 bandit25 bandit25 1679 Sep 19 07:08 bandit26.sshkey
-rw-r-----  1 bandit25 bandit25  151 Sep 19 07:08 .banner
-rw-r--r--  1 root     root      220 Mar 31 08:41 .bash_logout
-rw-r--r--  1 root     root     3771 Mar 31 08:41 .bashrc
-rw-r-----  1 bandit25 bandit25   66 Sep 19 07:08 .flag
-rw-r-----  1 bandit25 bandit25    4 Sep 19 07:08 .pin
-rw-r--r--  1 root     root      807 Mar 31 08:41 .profile
bandit25@bandit:~$ file bandit26.sshkey 
bandit26.sshkey: PEM RSA private key
```
Tenemos una llave privada para conectarnos al siguiente nivel.

* Intentemos conectarnos al siguiente nivel:
```bash
bandit25@bandit:~$ ssh -i bandit26.sshkey bandit26@localhost -p 2220
The authenticity of host '[localhost]:2220 ([127.0.0.1]:2220)' can't be established.
ED25519 key fingerprint is SHA256:C2ihUBV7ihnV1wUXRb4RrEcLfXC5CXlhmAAM/urerLY.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Could not create directory '/home/bandit25/.ssh' (Permission denied).
Failed to add the host to the list of known hosts (/home/bandit25/.ssh/known_hosts).
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
...
...
For support, questions or comments, contact us on discord or IRC.
*
  Enjoy your stay!
  _                     _ _ _   ___   __  

 | |                   | (_) | |__ \ / /  
 | |__   __ _ _ __   __| |_| |_   ) / /_  
 | '_ \ / _` | '_ \ / _` | | __| / / '_ \ 
 | |_) | (_| | | | | (_| | | |_ / /| (_) |
 |_.__/ \__,_|_| |_|\__,_|_|\__|____\___/ 
Connection to localhost closed.
```
Nos saca al instante.

* Veamos que nos dice el **archivo /etc/passwd**, quizá nos de una pista:
```bash
bandit25@bandit:~$ cat /etc/passwd | grep "bandit26"
bandit26:x:11026:11026:bandit level 26:/home/bandit26:/usr/bin/showtext
```
Aparece un binario **/usr/bin/showtext** que el que se ejecuta al inicar sesión.

* Veamos que es ese binario:
```bash
bandit25@bandit:~$ cat /usr/bin/showtext
#!/bin/sh
export TERM=linux
exec more ~/text.txt
exit 0
```
Parece que se ejecuta el **comando more** en un archivo llamado **text.txt** cuando inicia sesión.

* Tenemos que escapar del **comando more** que se esta ejecutando cuando iniciamos sesión en **bandit26**, lo que podemos hacer primero es dividir nuestra terminal en horizontal de tal modo que indique que **more** esta activo en la sesión actual.

<p align="center">
<img src="/assets/images/otw-writeups/bandit/Captura1.png">
</p>

<p align="center">
<img src="/assets/images/otw-writeups/bandit/Captura2.png">
</p>

* Ya aparece la **etiqueta more**, podemos escapar de este si presionamos la tecla `V` y luego presionamos las teclas `Esc + SHIFT + :` y es como si estuvieramos en **vim o vi**:

<p align="center">
<img src="/assets/images/otw-writeups/bandit/Captura3.png">
</p>

<p align="center">
<img src="/assets/images/otw-writeups/bandit/Captura4.png">
</p>

* Ahora indicamos que queremos cargar una **shell de Bash** con la instrucción `set shell=/bin/bash`:

<p align="center">
<img src="/assets/images/otw-writeups/bandit/Captura5.png">
</p>

* Y ahora si, indicamos que nos meta en una **shell de Bash** con las teclas `Esc + SHIFT + :shell + ENTER`:

<p align="center">
<img src="/assets/images/otw-writeups/bandit/Captura6.png">
</p>

* Y con esto ya tenemos una **sesión interactiva en bandit26**, igual podemos obtener la contraseña del nivel actual:
```bash
:shell
[No write since last change]
bandit26@bandit:~$ cat /etc/bandit_pass/bandit26
contraseña_nivel_actual
```

Excelente, tenemos la contraseña de este nivel.

Y de paso, podemos obtener la contraseña para **bandit27**.

* Veamos que encontramos en **bandit 26**:
```bash
bandit26@bandit:~$ ls -la
total 44
drwxr-xr-x  3 root     root      4096 Sep 19 07:08 .
drwxr-xr-x 70 root     root      4096 Sep 19 07:09 ..
-rwsr-x---  1 bandit27 bandit26 14880 Sep 19 07:08 bandit27-do
-rw-r--r--  1 root     root       220 Mar 31 08:41 .bash_logout
-rw-r--r--  1 root     root      3771 Mar 31 08:41 .bashrc
-rw-r--r--  1 root     root       807 Mar 31 08:41 .profile
drwxr-xr-x  2 root     root      4096 Sep 19 07:08 .ssh
-rw-r-----  1 bandit26 bandit26   258 Sep 19 07:08 text.txt
```

* Veamos que hace ese binario:
```bash
bandit26@bandit:~$ ./bandit27-do 
Run a command as another user.
  Example: ./bandit27-do id
```

* Es un binario similar a otro nivel en el que ocupamos un binario similar para obtener la contraseña del siguiente nivel, hagamos lo mismo aquí:
```bash
bandit26@bandit:~$ ./bandit27-do cat /etc/bandit_pass/bandit27
...
```

Y listo, ya tenemos la contraseña para **bandit27**.

Si queremos salir de todo, escribimos **exit** y presionamos las teclas `Esc + SHIFT + :` y escribimos **qa!**, de esta forma ya solo presionamos **ENTER** y nos sacara a **bandit25**.

<p align="center">
<img src="/assets/images/otw-writeups/bandit/Captura7.png">
</p>

Ahora si, vayamos a **bandit27**.

## Nivel 27 a 28 {#Nivel27}

**INSTRUCCIONES**:

Hay un **repositorio git** en `ssh://bandit27-git@localhost/home/bandit27-git/repo` a través del **puerto 2220**. La contraseña para el **usuario bandit27-git** es la misma que para el **usuario bandit27**.

Clona el repositorio y encuentra la contraseña para el siguiente nivel.

----------------

### Descripción de Comandos {#Exp27}

#### Comando git {#git}

| **Comando git** |
|:-----------:|
| *git es un sistema de control de versiones distribuido utilizado para gestionar proyectos de software. Permite a los desarrolladores realizar un seguimiento de los cambios en el código, colaborar en equipo y gestionar diferentes versiones de un proyecto de manera eficiente. Git se utiliza para almacenar, compartir y coordinar cambios en repositorios de código.* |

Formas de uso:
```bash
git [comando] [opciones]
```

**Comandos comunes de git**:
* Clonar un repositorio (git clone): Copia un repositorio existente en tu máquina local.
```bash
git clone https://github.com/usuario/repositorio.git
```

* Ver el estado del repositorio **(git status)**: Muestra el estado actual de los archivos en el repositorio, es decir, si están modificados, en seguimiento, etc.
```bash
git status
```

* Agregar archivos al área de preparación **(git add)**: Añade archivos o cambios al área de preparación para que puedan ser confirmados.
```bash
git add archivo.txt
# o para añadir todos los cambios:
git add .
```

* Confirmar cambios **(git commit)**: Guarda los cambios preparados en el repositorio local. Cada confirmación tiene un mensaje asociado que describe los cambios realizados.
```bash
git commit -m "Mensaje de confirmación"
```

* Enviar cambios a un repositorio remoto **(git push)**: Sube los cambios locales a un repositorio remoto, como **GitHub o GitLab**.
```bash
git push origin main
```

* Ver el historial de commits **(git log)**: Muestra el historial de commits en el proyecto.
```bash
git log
```

* Crear ramas para el proyecto **(git branch)**:
```bash
git branch nombre_nueva_rama
```

* Moviendonos entre ramas **(git checkout)**:
```bash
git checkout nombre_rama
```

* Clonando repositorio almacenado en **servidor SSH**:
```bash
git clone ssh://developer@example.com:2222/home/developer/repo.git
```

* Mostrando las diferencias entre tu directorio de trabajo y el área de preparación (o entre commits):
```bash
git diff
```

* Listando todas las etiquetas:
```bash
git tag
```

* Mostrando detalles de una etiqueta o commit:
```bash
git show nombre_etiqueta_o_commit
```

**Continuemos con la solución.**

### Solución {#Sol27}

Primero entremos al **servicio SSH**:
```bash
ssh bandit27@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit27@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 26**.

A partir de este nivel, es recomendable que te avientes un cursito de git, aunque puse algunos de los comandos más comunes y útiles, pienso que es mejor que lo practiques creando tu propio repositorio y jugando con el para entender su funcionamiento.

La idea es simple para este nivel, tan solo hay que clonar el repositorio que nos menciona las instrucciones y ahí se encontrara la contraseña para el siguiente nivel.

Probemos:

* Creando un directorio temporal como nuestro directorio de trabajo:
```bash
bandit27@bandit:~$ mktemp -d
/tmp/tmp.zkF49m44SS
bandit27@bandit:~$ cd /tmp/tmp.zkF49m44SS
bandit27@bandit:/tmp/tmp.zkF49m44SS$
```

* Clonando el repositor especificando el puerto:

```bash
bandit27@bandit:/tmp/tmp.zkF49m44SS$ git clone ssh://bandit27-git@localhost:2220/home/bandit27-git/repo
Cloning into 'repo'...
The authenticity of host '[localhost]:2220 ([127.0.0.1]:2220)' can't be established.
ED25519 key fingerprint is SHA256:C2ihUBV7ihnV1wUXRb4RrEcLfXC5CXlhmAAM/urerLY.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Could not create directory '/home/bandit27/.ssh' (Permission denied).
Failed to add the host to the list of known hosts (/home/bandit27/.ssh/known_hosts).
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
*
bandit27-git@localhost's password: 
remote: Enumerating objects: 3, done.
remote: Counting objects: 100% (3/3), done.
remote: Compressing objects: 100% (2/2), done.
remote: Total 3 (delta 0), reused 0 (delta 0), pack-reused 0
Receiving objects: 100% (3/3), done.
```

* Navegando en el repositorio y leyendo el **archivo README**:

```bash
bandit27@bandit:/tmp/tmp.zkF49m44SS$ ls -la
total 168
drwx------    3 bandit27 bandit27   4096 Sep 25 23:21 .
drwxrwx-wt 2670 root     root     159744 Sep 25 23:21 ..
drwxrwxr-x    3 bandit27 bandit27   4096 Sep 25 23:21 repo
bandit27@bandit:/tmp/tmp.zkF49m44SS$ cd repo/
bandit27@bandit:/tmp/tmp.zkF49m44SS/repo$ ls -la
total 16
drwxrwxr-x 3 bandit27 bandit27 4096 Sep 25 23:21 .
drwx------ 3 bandit27 bandit27 4096 Sep 25 23:21 ..
drwxrwxr-x 8 bandit27 bandit27 4096 Sep 25 23:21 .git
-rw-rw-r-- 1 bandit27 bandit27   68 Sep 25 23:21 README
bandit27@bandit:/tmp/tmp.zkF49m44SS/repo$ cat README 
The password to the next level is: contraseña_siguiente_nivel.
```

Listo, ya completamos este nivel.

## Nivel 28 a 29 {#Nivel28}

**INSTRUCCIONES**:

Hay un **repositorio git** en `ssh://bandit28-git@localhost/home/bandit28-git/repo` a través del **puerto 2220**. La contraseña para el **usuario bandit28-git** es la misma que para el **usuario bandit28**.

Clona el repositorio y encuentra la contraseña para el siguiente nivel.

----------------

### Solución {#Sol28}

Primero entremos al **servicio SSH**:
```bash
ssh bandit28@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit28@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 27**.

Debemos descargar el repositorio y encontrar la contraseña, el chiste aquí es que no estará la contraseña sino una pista.

Probemos:

* Creando directorio temporal como nuestro directorio de trabajo:
```bash
bandit28@bandit:~$ mktemp -d
/tmp/tmp.4aIUGcxtoj
bandit28@bandit:~$ cd /tmp/tmp.4aIUGcxtoj
bandit28@bandit:/tmp/tmp.4aIUGcxtoj$
```

* Clonando el repositor especificando el puerto:
```bash
bandit28@bandit:/tmp/tmp.4aIUGcxtoj$ git clone ssh://bandit28-git@localhost:2220/home/bandit28-git/repo
Cloning into 'repo'...
The authenticity of host '[localhost]:2220 ([127.0.0.1]:2220)' can't be established.
ED25519 key fingerprint is SHA256:C2ihUBV7ihnV1wUXRb4RrEcLfXC5CXlhmAAM/urerLY.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Could not create directory '/home/bandit28/.ssh' (Permission denied).
Failed to add the host to the list of known hosts (/home/bandit28/.ssh/known_hosts).
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
*
bandit28-git@localhost's password: 
remote: Enumerating objects: 9, done.
remote: Counting objects: 100% (9/9), done.
remote: Compressing objects: 100% (6/6), done.
remote: Total 9 (delta 2), reused 0 (delta 0), pack-reused 0
Receiving objects: 100% (9/9), done.
Resolving deltas: 100% (2/2), done.
```

* Navegando en el repositorio y revisando pistas:

```bash
bandit28@bandit:/tmp/tmp.4aIUGcxtoj$ ls -la
total 168
drwx------    3 bandit28 bandit28   4096 Sep 25 23:56 .
drwxrwx-wt 2694 root     root     159744 Sep 25 23:56 ..
drwxrwxr-x    3 bandit28 bandit28   4096 Sep 25 23:56 repo
bandit28@bandit:/tmp/tmp.4aIUGcxtoj$ cd repo/
bandit28@bandit:/tmp/tmp.4aIUGcxtoj/repo$ ls -la
total 16
drwxrwxr-x 3 bandit28 bandit28 4096 Sep 25 23:56 .
drwx------ 3 bandit28 bandit28 4096 Sep 25 23:56 ..
drwxrwxr-x 8 bandit28 bandit28 4096 Sep 25 23:56 .git
-rw-rw-r-- 1 bandit28 bandit28  111 Sep 25 23:56 README.md
bandit28@bandit:/tmp/tmp.4aIUGcxtoj/repo$ cat README.md 
# Bandit Notes
Some notes for level29 of bandit.
## credentials
- username: bandit29
- password: xxxxxxxxxx
```
Esto me da a entender que se cambio el archivo original, pero podemos ver las distintas versiones de este archivo con el parámetro log.

* Revisando el historial de cambios realizados con el parámetro `log`:
```bash
bandit28@bandit:/tmp/tmp.4aIUGcxtoj/repo$ git log
commit 817e303aa6c2b207ea043c7bba1bb7575dc4ea73 (HEAD -> master, origin/master, origin/HEAD)
Author: Morla Porla <morla@overthewire.org>
Date:   Thu Sep 19 07:08:39 2024 +0000
*
    fix info leak
*
commit 3621de89d8eac9d3b64302bfb2dc67e9a566decd
Author: Morla Porla <morla@overthewire.org>
Date:   Thu Sep 19 07:08:39 2024 +0000
*
    add missing data
*
commit 0622b73250502618babac3d174724bb303c32182
Author: Ben Dover <noone@overthewire.org>
Date:   Thu Sep 19 07:08:39 2024 +0000
*
    initial commit of README.md
```

* Revisando esos cambios con el parámetro `show id_commit`:

```bash
bandit28@bandit:/tmp/tmp.4aIUGcxtoj/repo$ git show 817e303aa6c2b207ea043c7bba1bb7575dc4ea73
commit 817e303aa6c2b207ea043c7bba1bb7575dc4ea73 (HEAD -> master, origin/master, origin/HEAD)
Author: Morla Porla <morla@overthewire.org>
Date:   Thu Sep 19 07:08:39 2024 +0000
*
    fix info leak
*
diff --git a/README.md b/README.md
index d4e3b74..5c6457b 100644
--- a/README.md
+++ b/README.md
@@ -4,5 +4,5 @@ Some notes for level29 of bandit.
 ## credentials
 - username: bandit29
-- password: contraseña_siguiente_nivel
+- password: xxxxxxxxxx
bandit28@bandit:/tmp/tmp.4aIUGcxtoj/repo$ git show 3621de89d8eac9d3b64302bfb2dc67e9a566decd
commit 3621de89d8eac9d3b64302bfb2dc67e9a566decd
Author: Morla Porla <morla@overthewire.org>
Date:   Thu Sep 19 07:08:39 2024 +0000
*
    add missing data
*
diff --git a/README.md b/README.md
index 7ba2d2f..d4e3b74 100644
--- a/README.md
+++ b/README.md
@@ -4,5 +4,5 @@ Some notes for level29 of bandit.
 ## credentials
 - username: bandit29
-- password: <TBD>
+- password: contraseña_siguiente_nivel
```

Listo, ya tenemos la contraseña para el siguiente nivel.

## Nivel 29 a 30 {#Nivel29}

**INSTRUCCIONES**:

Hay un **repositorio git** en `ssh://bandit29-git@localhost/home/bandit29-git/repo` a través del **puerto 2220**. La contraseña para el **usuario bandit29-git** es la misma que para el **usuario bandit29**.

Clona el repositorio y encuentra la contraseña para el siguiente nivel.

----------------

### Solución {#Sol29}

Primero entremos al **servicio SSH**:
```bash
ssh bandit29@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit29@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 28**.

Debemos descargar el repositorio y encontrar la contraseña, el chiste aquí es que no estará la contraseña sino una pista.

Probemos:

* Creando directorio temporal como nuestro directorio de trabajo:
```bash
bandit29@bandit:~$ mktemp -d
/tmp/tmp.CZmVcR6wWk
bandit29@bandit:~$ cd /tmp/tmp.CZmVcR6wWk
bandit29@bandit:/tmp/tmp.CZmVcR6wWk$
```

* Clonando el repositor especificando el puerto:
```bash
bandit29@bandit:/tmp/tmp.CZmVcR6wWk$ git clone ssh://bandit29-git@localhost:2220/home/bandit29-git/repo
Cloning into 'repo'...
The authenticity of host '[localhost]:2220 ([127.0.0.1]:2220)' can't be established.
ED25519 key fingerprint is SHA256:C2ihUBV7ihnV1wUXRb4RrEcLfXC5CXlhmAAM/urerLY.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes     
Could not create directory '/home/bandit29/.ssh' (Permission denied).
Failed to add the host to the list of known hosts (/home/bandit29/.ssh/known_hosts).
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
*
bandit29-git@localhost's password: 
remote: Enumerating objects: 16, done.
remote: Counting objects: 100% (16/16), done.
remote: Compressing objects: 100% (11/11), done.
remote: Total 16 (delta 2), reused 0 (delta 0), pack-reused 0
Receiving objects: 100% (16/16), done.
Resolving deltas: 100% (2/2), done.
```

* Navegando en el repositorio, buscando pistas:

```bash
bandit29@bandit:/tmp/tmp.CZmVcR6wWk$ ls -la
total 168
drwx------    3 bandit29 bandit29   4096 Sep 26 00:17 .
drwxrwx-wt 2711 root     root     159744 Sep 26 00:17 ..
drwxrwxr-x    3 bandit29 bandit29   4096 Sep 26 00:17 repo
bandit29@bandit:/tmp/tmp.CZmVcR6wWk$ cd repo/
bandit29@bandit:/tmp/tmp.CZmVcR6wWk/repo$ ls -a
.  ..  .git  README.md
bandit29@bandit:/tmp/tmp.CZmVcR6wWk/repo$ ls -la
total 16
drwxrwxr-x 3 bandit29 bandit29 4096 Sep 26 00:17 .
drwx------ 3 bandit29 bandit29 4096 Sep 26 00:17 ..
drwxrwxr-x 8 bandit29 bandit29 4096 Sep 26 00:17 .git
-rw-rw-r-- 1 bandit29 bandit29  131 Sep 26 00:17 README.md
bandit29@bandit:/tmp/tmp.CZmVcR6wWk/repo$ cat README.md 
# Bandit Notes
Some notes for bandit30 of bandit.
## credentials
- username: bandit30
- password: <no passwords in production!>
```
Esto me da a entender que pueden existir ramas en este proyecto, ya que menciona que **no hay contraseñas en producción**, por lo que deben existir una rama por ahí que si la tenga.

* Revisando si existen más ramas:

```bash
bandit29@bandit:/tmp/tmp.CZmVcR6wWk/repo$ git branch -a
* master
  remotes/origin/HEAD -> origin/master
  remotes/origin/dev
  remotes/origin/master
  remotes/origin/sploits-dev
```

* Investigando que rama tiene la contraseña para el siguiente nivel:

```bash
bandit29@bandit:/tmp/tmp.CZmVcR6wWk/repo$ git checkout dev
branch 'dev' set up to track 'origin/dev'.
Switched to a new branch 'dev'
bandit29@bandit:/tmp/tmp.CZmVcR6wWk/repo$ ls -la
total 20
drwxrwxr-x 4 bandit29 bandit29 4096 Sep 26 00:18 .
drwx------ 3 bandit29 bandit29 4096 Sep 26 00:17 ..
drwxrwxr-x 2 bandit29 bandit29 4096 Sep 26 00:18 code
drwxrwxr-x 8 bandit29 bandit29 4096 Sep 26 00:18 .git
-rw-rw-r-- 1 bandit29 bandit29  134 Sep 26 00:18 README.md
bandit29@bandit:/tmp/tmp.CZmVcR6wWk/repo$ cat README.md 
# Bandit Notes
Some notes for bandit30 of bandit.
## credentials
- username: bandit30
- password: contraseña_siguiente_nivel
```

Listo, completamos este nivel.

## Nivel 30 a 31 {#Nivel30}

**INSTRUCCIONES**:

Hay un **repositorio git** en `ssh://bandit30-git@localhost/home/bandit30-git/repo` a través del **puerto 2220**. La contraseña para el **usuario bandit30-git** es la misma que para el **usuario bandit30**.

Clona el repositorio y encuentra la contraseña para el siguiente nivel.

----------------

### Solución {#Sol30}

Primero entremos al **servicio SSH**:
```bash
ssh bandit30@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit30@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 29**.

Debemos descargar el repositorio y encontrar la contraseña, el chiste aquí es que no estará la contraseña sino una pista.

Probemos:

* Creando directorio temporal como nuestro directorio de trabajo:
```bash
bandit30@bandit:~$ mktemp -d
/tmp/tmp.4NWua6xgyt
bandit30@bandit:~$ cd /tmp/tmp.4NWua6xgyt
bandit30@bandit:/tmp/tmp.4NWua6xgyt$
```

* Clonando el repositorio especificando el puerto:
```bash
bandit30@bandit:/tmp/tmp.4NWua6xgyt$ git clone ssh://bandit30-git@localhost:2220/home/bandit30-git/repo
Cloning into 'repo'...
The authenticity of host '[localhost]:2220 ([127.0.0.1]:2220)' can't be established.
ED25519 key fingerprint is SHA256:C2ihUBV7ihnV1wUXRb4RrEcLfXC5CXlhmAAM/urerLY.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Could not create directory '/home/bandit30/.ssh' (Permission denied).
Failed to add the host to the list of known hosts (/home/bandit30/.ssh/known_hosts).
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
*
bandit30-git@localhost's password: 
remote: Enumerating objects: 4, done.
remote: Counting objects: 100% (4/4), done.
remote: Total 4 (delta 0), reused 0 (delta 0), pack-reused 0
Receiving objects: 100% (4/4), done.
```

* Navegando dentro del repositorio, buscando pistas:
```bash
bandit30@bandit:/tmp/tmp.4NWua6xgyt$ ls -la
total 168
drwx------    3 bandit30 bandit30   4096 Sep 26 00:59 .
drwxrwx-wt 2747 root     root     159744 Sep 26 00:59 ..
drwxrwxr-x    3 bandit30 bandit30   4096 Sep 26 00:59 repo
bandit30@bandit:/tmp/tmp.4NWua6xgyt$ cd repo/
bandit30@bandit:/tmp/tmp.4NWua6xgyt/repo$ ls -la
total 16
drwxrwxr-x 3 bandit30 bandit30 4096 Sep 26 00:59 .
drwx------ 3 bandit30 bandit30 4096 Sep 26 00:59 ..
drwxrwxr-x 8 bandit30 bandit30 4096 Sep 26 00:59 .git
-rw-rw-r-- 1 bandit30 bandit30   30 Sep 26 00:59 README.md
bandit30@bandit:/tmp/tmp.4NWua6xgyt/repo$ cat README.md 
just an epmty file... muahaha
```
Según la pista no hay nada más que un archivo vacio, si buscamos los logs o si hay ramas, no encontraremos nada por lo que lo único que faltaría es revisar si no hay etiquetas.

* Revisando si hay etiquetas en el repositorio:
```bash
bandit30@bandit:/tmp/tmp.4NWua6xgyt/repo$ git tag
secret
```

* Mostrando el contenido de la etiqueta encontrada:
```bash
bandit30@bandit:/tmp/tmp.4NWua6xgyt/repo$ git show secret
contrasñe_siguiente_nivel
```

Listo, ya completamos este nivel.

## Nivel 31 a 32 {#Nivel31}

**INSTRUCCIONES**:

Hay un **repositorio** git en `ssh://bandit31-git@localhost/home/bandit31-git/repo` a través del **puerto 2220**. La contraseña para el **usuario bandit31-git** es la misma que para el **usuario bandit31**.

Clona el repositorio y encuentra la contraseña para el siguiente nivel.

----------------

### Solución {#Sol31}

Primero entremos al **servicio SSH**:
```bash
ssh bandit31@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit31@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 30**.

Debemos descargar el repositorio y encontrar la contraseña, el chiste aquí es que no estará la contraseña sino una pista.

Probemos:

* Creando directorio temporal como nuestro directorio de trabajo:
```bash
bandit31@bandit:~$ mktemp -d
/tmp/tmp.osHpu3TtW8
bandit31@bandit:~$ cd /tmp/tmp.osHpu3TtW8
bandit31@bandit:/tmp/tmp.osHpu3TtW8$
```

* Clonando repositorio especificando el puerto:
```bash
bandit31@bandit:/tmp/tmp.osHpu3TtW8$ git clone ssh://bandit31-git@localhost:2220/home/bandit31-git/repo
Cloning into 'repo'...
The authenticity of host '[localhost]:2220 ([127.0.0.1]:2220)' can't be established.
ED25519 key fingerprint is SHA256:C2ihUBV7ihnV1wUXRb4RrEcLfXC5CXlhmAAM/urerLY.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Could not create directory '/home/bandit31/.ssh' (Permission denied).
Failed to add the host to the list of known hosts (/home/bandit31/.ssh/known_hosts).
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
*
bandit31-git@localhost's password: 
remote: Enumerating objects: 4, done.
remote: Counting objects: 100% (4/4), done.
remote: Compressing objects: 100% (3/3), done.
remote: Total 4 (delta 0), reused 0 (delta 0), pack-reused 0
Receiving objects: 100% (4/4), 381 bytes | 127.00 KiB/s, done.
```

* Navegando en el repositorio, buscando pistas:
```bash
bandit31@bandit:/tmp/tmp.osHpu3TtW8$ ls -la
total 168
drwx------    3 bandit31 bandit31   4096 Sep 26 01:11 .
drwxrwx-wt 2757 root     root     159744 Sep 26 01:11 ..
drwxrwxr-x    3 bandit31 bandit31   4096 Sep 26 01:11 repo
bandit31@bandit:/tmp/tmp.osHpu3TtW8$ cd repo/
bandit31@bandit:/tmp/tmp.osHpu3TtW8/repo$ ls -la
total 20
drwxrwxr-x 3 bandit31 bandit31 4096 Sep 26 01:11 .
drwx------ 3 bandit31 bandit31 4096 Sep 26 01:11 ..
drwxrwxr-x 8 bandit31 bandit31 4096 Sep 26 01:11 .git
-rw-rw-r-- 1 bandit31 bandit31    6 Sep 26 01:11 .gitignore
-rw-rw-r-- 1 bandit31 bandit31  147 Sep 26 01:11 README.md
bandit31@bandit:/tmp/tmp.osHpu3TtW8/repo$ cat README.md 
This time your task is to push a file to the remote repository.
Details:
    File name: key.txt
    Content: 'May I come in?'
    Branch: master
```
Ya nos dieron la respuesta, debemos crear un archivo de texto que contenga la frase **"May I come in?"** y luego intentar agregar ese archivo al repositorio en la rama de **master** (que es en la que nos encontramos), haciendo esto nos daran la contraseña para el último nivel.

* Creando el archivo, agregandolo al repo y haciendo un **commit** para agregar nuestro archivo con un comentario random:
```bash
bandit31@bandit:/tmp/tmp.osHpu3TtW8/repo$ echo "May I come in?" > key.txt
bandit31@bandit:/tmp/tmp.osHpu3TtW8/repo$ ls
key.txt  README.md
bandit31@bandit:/tmp/tmp.osHpu3TtW8/repo$ git add -f key.txt
bandit31@bandit:/tmp/tmp.osHpu3TtW8/repo$ git status
On branch master
Your branch is up to date with 'origin/master'.
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        new file:   key.txt
bandit31@bandit:/tmp/tmp.osHpu3TtW8/repo$ git commit -m "Denme la contraseña plox, tenkiu"
[master e38c923] Denme la contraseña plox, tenkiu
 1 file changed, 1 insertion(+)
 create mode 100644 key.txt
bandit31@bandit:/tmp/tmp.osHpu3TtW8/repo$ git status
On branch master
Your branch is ahead of 'origin/master' by 1 commit.
  (use "git push" to publish your local commits)
```

* Subiendo nuestro archivo al repositorio remoto:
```bash 
bandit31@bandit:/tmp/tmp.osHpu3TtW8/repo$ git push -u origin master
The authenticity of host '[localhost]:2220 ([127.0.0.1]:2220)' can't be established.
ED25519 key fingerprint is SHA256:C2ihUBV7ihnV1wUXRb4RrEcLfXC5CXlhmAAM/urerLY.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Could not create directory '/home/bandit31/.ssh' (Permission denied).
Failed to add the host to the list of known hosts (/home/bandit31/.ssh/known_hosts).
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       
                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames
*
bandit31-git@localhost's password: 
Enumerating objects: 4, done.
Counting objects: 100% (4/4), done.
Delta compression using up to 2 threads
Compressing objects: 100% (2/2), done.
Writing objects: 100% (3/3), 348 bytes | 348.00 KiB/s, done.
Total 3 (delta 0), reused 0 (delta 0), pack-reused 0
remote: ### Attempting to validate files... ####
remote: 
remote: .oOo.oOo.oOo.oOo.oOo.oOo.oOo.oOo.oOo.oOo.
remote: 
remote: Well done! Here is the password for the next level:
remote: contraseña_siguiente_nivel
remote: 
remote: .oOo.oOo.oOo.oOo.oOo.oOo.oOo.oOo.oOo.oOo.
remote: 
To ssh://localhost:2220/home/bandit31-git/repo
 ! [remote rejected] master -> master (pre-receive hook declined)
error: failed to push some refs to 'ssh://localhost:2220/home/bandit31-git/repo'
```

Listo, ya completamos este nivel.

## Nivel 32 a 33 {#Nivel32}

**INSTRUCCIONES**:

Después de tanto **git**, es hora de otra escapada. ¡Buena suerte!

----------------

### Descripción de Comandos {#Exp32}

#### Argumentos Posicionales en Bash {#argumentos}

| **Argumentos Posicionales en Bash** |
|:-----------:|
| *En Bash, los argumentos posicionales son los valores que pasas a un script o comando cuando lo ejecutas. Estos argumentos se almacenan en variables especiales con un número correspondiente a su posición.* | 

Variables de argumentos posicionales:
* `$0`: Representa el nombre del script o comando que se está ejecutando.
* `$1, $2, $3, etc.`: Son los argumentos que se pasan al script, donde `$1` es el primer argumento, `$2` el segundo, y así sucesivamente.
* `$#`: Muestra la cantidad de argumentos posicionales que se han pasado al script.
* `$@`: Representa todos los argumentos pasados al script, separados por espacios.
* `$*`: Similar a `$@`, pero trata los argumentos como una sola cadena.
* `$?`: Devuelve el código de salida del último comando ejecutado.

Ejemplo:
* En tu terminal, escribe el argumento `echo $0`:
```bash
echo $0
> zsh
```

* Abre una sesión de **Bash** (esto si es que tienes **zsh**) y aplica el mismo comando:
```bash
bash
echo $0
> bash
exit
```
Observa que lo que nos devuelve, nos servira en este nivel.

**Continuemos con la solución.**

### Solución {#Sol32}

Primero entremos al **servicio SSH**:
```bash
ssh bandit32@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit32@bandit.labs.overthewire.org's password:
```
La contraseña es la que encontraste en el **nivel 31**.

No nos dan ninguna pista, pero una vez que entramos, cualquier comando que intentemos ejecutar nos lo cambia a texto en mayúsculas. Esto nos complica un poco la forma de poder escapar, pero para eso tenemos los argumentos posicionales.

En teoría, los comandos si se estarían ejecutando, el problema es que los convierte a mayúsculas y si nosotros usamos el argumento `$0` que ejecuta una **Bash**, podría ayudarnos a escapar.

Probemos:

* Intentando ejecutar comandos:
```bash
WELCOME TO THE UPPERCASE SHELL
>> ls
sh: 1: LS: Permission denied
>> mktemp -d
sh: 1: MKTEMP: Permission denied
>>
```

* Usando argumento posicional `$0`:
```bash
>> $0
$ ls
uppershell
$ pwd
/home/bandit32
$ ls -la
total 36
drwxr-xr-x  2 root     root      4096 Sep 19 07:08 .
drwxr-xr-x 70 root     root      4096 Sep 19 07:09 ..
-rw-r--r--  1 root     root       220 Mar 31 08:41 .bash_logout
-rw-r--r--  1 root     root      3771 Mar 31 08:41 .bashrc
-rw-r--r--  1 root     root       807 Mar 31 08:41 .profile
-rwsr-x---  1 bandit33 bandit32 15136 Sep 19 07:08 uppershell
```

* Obteniendo una sesión de Bash y obtenemos la contraseña de **bandit33**:
```bash
$ bash
bandit33@bandit:~$ ls -la
total 36
drwxr-xr-x  2 root     root      4096 Sep 19 07:08 .
drwxr-xr-x 70 root     root      4096 Sep 19 07:09 ..
-rw-r--r--  1 root     root       220 Mar 31 08:41 .bash_logout
-rw-r--r--  1 root     root      3771 Mar 31 08:41 .bashrc
-rw-r--r--  1 root     root       807 Mar 31 08:41 .profile
-rwsr-x---  1 bandit33 bandit32 15136 Sep 19 07:08 uppershell
bandit33@bandit:~$ cat /etc/bandit_pass/bandit33
última_contraseña
```

Y listo, completamos este nivel.

Este fue el último nivel de **Bandit** que podemos probar, pero aun así podemos entrar a **bandit33**.

Veamos que nos enseñan si entramos en **bandit33**.
```bash
ssh bandit33@bandit.labs.overthewire.org -p2220
                         _                     _ _ _   

                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

bandit33@bandit.labs.overthewire.org's password:
...
...
...
Enjoy your stay!
bandit33@bandit:~$ ls -la
total 24
drwxr-xr-x  2 root     root     4096 Sep 19 07:08 .
drwxr-xr-x 70 root     root     4096 Sep 19 07:09 ..
-rw-r--r--  1 root     root      220 Mar 31 08:41 .bash_logout
-rw-r--r--  1 root     root     3771 Mar 31 08:41 .bashrc
-rw-r--r--  1 root     root      807 Mar 31 08:41 .profile
-rw-------  1 bandit33 bandit33  430 Sep 19 07:08 README.txt
bandit33@bandit:~$ cat README.txt 
Congratulations on solving the last level of this game!

At this moment, there are no more levels to play in this game. However, we are constantly working
on new levels and will most likely expand this game with more levels soon.
Keep an eye out for an announcement on our usual communication channels!
In the meantime, you could play some of our other wargames.

If you have an idea for an awesome new level, please let us know!
```

Un mensaje final que nos felicita por completar el último nivel.

Muchas gracias si llegaste hasta aquí viendo mi guía, espero que te haya servido Uwu.
